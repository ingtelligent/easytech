// Setting.js - Enhanced with Better Level Progress Position
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  Platform,
  RefreshControl,
  Dimensions,
  BackHandler,
  Linking,
  Animated,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import TabBar from '../TabBar';
import Header from '../Header';
import { UserPreferences } from '../UserPreferences';

const { width: screenWidth } = Dimensions.get('window');

// Level system configuration
const LEVEL_CONFIG = {
  pointsPerLevel: [0, 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000],
  levelTitles: [
    "Người mới",
    "Học viên", 
    "Thành thạo",
    "Chuyên gia",
    "Bậc thầy",
    "Siêu sao",
    "Huyền thoại", 
    "Đại sư",
    "Vô địch",
    "Tối cao"
  ]
};

// Calculate level info helper
const calculateLevelInfo = (points) => {
  let currentLevel = 1;
  let currentLevelPoints = 0;
  let nextLevelPoints = LEVEL_CONFIG.pointsPerLevel[1] || 100;

  for (let i = 0; i < LEVEL_CONFIG.pointsPerLevel.length - 1; i++) {
    if (points >= LEVEL_CONFIG.pointsPerLevel[i + 1]) {
      currentLevel = i + 2;
      currentLevelPoints = LEVEL_CONFIG.pointsPerLevel[i + 1];
      nextLevelPoints = LEVEL_CONFIG.pointsPerLevel[i + 2] || currentLevelPoints;
    } else {
      break;
    }
  }

  // Handle max level
  if (currentLevel >= LEVEL_CONFIG.pointsPerLevel.length) {
    currentLevel = LEVEL_CONFIG.pointsPerLevel.length;
    currentLevelPoints = LEVEL_CONFIG.pointsPerLevel[currentLevel - 1];
    nextLevelPoints = currentLevelPoints;
  }

  const progressInCurrentLevel = points - currentLevelPoints;
  const pointsNeededForNext = nextLevelPoints - currentLevelPoints;
  const progress = pointsNeededForNext > 0 ? progressInCurrentLevel / pointsNeededForNext : 1;

  return {
    level: currentLevel,
    progress: Math.max(0, Math.min(1, progress)),
    pointsForNext: Math.max(0, nextLevelPoints - points),
    title: LEVEL_CONFIG.levelTitles[currentLevel - 1] || "Tối cao",
    isMaxLevel: currentLevel >= LEVEL_CONFIG.pointsPerLevel.length,
    currentLevelPoints,
    nextLevelPoints
  };
};

// Error Boundary for Setting screen
class SettingErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Setting Error Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color="#e74c3c" />
          <Text style={styles.errorTitle}>Đã có lỗi xảy ra</Text>
          <Text style={styles.errorMessage}>
            Vui lòng thử lại hoặc khởi động lại ứng dụng
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const Setting = () => {
  const navigation = useNavigation();
  
  const {
    preferences,
    user,
    loading: preferencesLoading,
    updatePreferences,
    getFontSize,
    getComponentSizes,
    getFontSizeDescription,
    resetToDefaults,
  } = UserPreferences();

  /* -------------------- STATE -------------------- */
  const [userProfile, setUserProfile] = useState({
    name: 'Người dùng',
    level: 1,
    points: 0,
    completedTasks: 0,
    viewedGuides: 0,
    assistantQuestions: 0,
  });
  
  const [emergencyContacts, setEmergencyContacts] = useState([
    { id: 1, name: 'Liên hệ khẩn cấp 1', phone: null },
    { id: 2, name: 'Liên hệ khẩn cấp 2', phone: null },
    { id: 3, name: 'Liên hệ khẩn cấp 3', phone: null },
  ]);
  
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState({
    displayName: '',
    email: '',
    profilePic: null,
    photoURL: '',
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [errors, setErrors] = useState({});

  // Animation for level progress
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Refs for managing component lifecycle and preventing race conditions
  const isMountedRef = useRef(true);
  const loadingStateRef = useRef({
    profile: false,
    contacts: false,
  });

  const fontSizeAdditions = [-4, -2, 0, 4, 8];
  const fontSizeLabels = ['Rất nhỏ', 'Nhỏ', 'Trung bình', 'Lớn', 'Rất lớn'];
  const fontSizeIndex = fontSizeAdditions.indexOf(preferences.fontSizeAddition);
  const sizes = getComponentSizes();

  // Calculate level info for current user
  const levelInfo = useMemo(() => {
    return calculateLevelInfo(userProfile.points);
  }, [userProfile.points]);

  // Animate progress bar when level info changes
  useEffect(() => {
    Animated.parallel([
      Animated.timing(progressAnim, {
        toValue: levelInfo.progress,
        duration: 1200,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ])
    ]).start();
  }, [levelInfo.progress, progressAnim, scaleAnim]);

  /* -------------------- UTILITY FUNCTIONS -------------------- */
  const showError = useCallback((message, error = null) => {
    console.error(message, error);
    Alert.alert('Lỗi', message);
  }, []);

  const showSuccess = useCallback((message) => {
    Alert.alert('Thành công', message);
  }, []);

  const getDefaultEmergencyContacts = () => [
    { id: 1, name: 'Liên hệ khẩn cấp 1', phone: null },
    { id: 2, name: 'Liên hệ khẩn cấp 2', phone: null },
    { id: 3, name: 'Liên hệ khẩn cấp 3', phone: null },
  ];

  /* -------------------- NAVIGATION -------------------- */
  const navigateIfExists = useCallback((route) => {
    try {
      navigation.navigate(route);
    } catch (error) {
      showError(`Màn hình ${route} không tồn tại.`);
    }
  }, [navigation, showError]);

  const handleTabPress = useCallback((tab) => navigateIfExists(tab), [navigateIfExists]);

  // Handle hardware back button
  useEffect(() => {
    const handleBackPress = () => {
      if (modalVisible || profileModalVisible) {
        setModalVisible(false);
        setProfileModalVisible(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [modalVisible, profileModalVisible]);

  /* -------------------- FIRESTORE HELPERS -------------------- */
  const createDefaultUserDocument = useCallback(async (userId) => {
    if (loadingStateRef.current.profile) return;
    
    try {
      console.log('Creating default user document for:', userId);
      
      const currentUser = auth().currentUser;
      const defaultContacts = getDefaultEmergencyContacts();
      
      const defaultData = {
        displayName: currentUser?.displayName || 'Người dùng',
        email: currentUser?.email || null,
        photoURL: currentUser?.photoURL || null,
        level: 1,
        points: 0,
        completedTasksCount: 0,
        viewedGuides: 0,
        assistantQuestions: 0,
        emergencyContacts: defaultContacts,
        preferences: { 
          dialect: 'north', 
          fontSizeAddition: 0,
          gender: 'female'
        },
        createdAt: firestore.FieldValue.serverTimestamp(),
        lastLogin: firestore.FieldValue.serverTimestamp(),
      };
      
      // Use transaction to ensure data consistency
      await firestore().runTransaction(async (transaction) => {
        const userRef = firestore().collection('users').doc(userId);
        const doc = await transaction.get(userRef);
        
        if (!doc.exists) {
          transaction.set(userRef, defaultData);
        } else {
          transaction.update(userRef, {
            lastLogin: firestore.FieldValue.serverTimestamp(),
          });
        }
      });
      
      // Set state after successful creation
      if (isMountedRef.current) {
        setUserProfile((prev) => ({
          ...prev,
          level: defaultData.level,
          points: defaultData.points,
          completedTasks: defaultData.completedTasksCount,
          viewedGuides: defaultData.viewedGuides,
          assistantQuestions: defaultData.assistantQuestions,
        }));
        
        setEmergencyContacts(defaultData.emergencyContacts);
      }
      
      console.log('Default user document created successfully');
      
    } catch (createErr) {
      console.error('Failed to create default user document:', createErr);
      showError('Không thể tạo dữ liệu mặc định. Vui lòng thử lại.');
      
      // Still set default emergency contacts in state
      if (isMountedRef.current) {
        setEmergencyContacts(getDefaultEmergencyContacts());
      }
    }
  }, [showError]);

  /* -------------------- ENHANCED DATA LOADING -------------------- */
  const loadUserData = useCallback(async (userId, retryCount = 0) => {
    if (!userId || loadingStateRef.current.profile) return;
    
    loadingStateRef.current.profile = true;
    
    try {
      console.log(`Loading user data for: ${userId} (attempt ${retryCount + 1})`);
      
      // Use source option for better caching control
      const docSnap = await firestore()
        .collection('users')
        .doc(userId)
        .get({ source: retryCount > 0 ? 'server' : 'default' });
      
      if (!isMountedRef.current) return;
      
      if (!docSnap.exists) {
        console.warn('User document does not exist, creating default...');
        await createDefaultUserDocument(userId);
        return;
      }
      
      const data = docSnap.data();
      if (!data) {
        console.warn('User data is undefined for UID:', userId);
        await createDefaultUserDocument(userId);
        return;
      }

      // Load user profile with enhanced calculation
      const calculatedPoints = (data.points || 0) + 
                              (data.completedTasks?.length || 0) * 50 + 
                              (data.viewedGuides || 0) * 20 + 
                              (data.assistantQuestions || 0) * 10;

      setUserProfile((prev) => ({
        ...prev,
        level: data.level ?? 1,
        points: calculatedPoints,
        completedTasks: data.completedTasksCount ?? 0,
        viewedGuides: data.viewedGuides ?? 0,
        assistantQuestions: data.assistantQuestions ?? 0,
      }));

      // Enhanced emergency contacts handling
      await loadEmergencyContactsFromData(data, userId);
      
    } catch (err) {
      console.error('Firestore read error:', err);
      
      // Enhanced error handling with retry logic
      if (retryCount < 2 && isMountedRef.current) {
        console.log(`Retrying data load in ${(retryCount + 1) * 1000}ms...`);
        setTimeout(() => {
          if (isMountedRef.current) {
            loadUserData(userId, retryCount + 1);
          }
        }, (retryCount + 1) * 1000);
        return;
      }
      
      // Handle specific error cases
      let errorMessage = 'Không thể tải dữ liệu người dùng.';
      
      if (err.code === 'permission-denied') {
        errorMessage = 'Không có quyền truy cập dữ liệu. Vui lòng đăng nhập lại.';
        try {
          await auth().signOut();
          navigation.navigate('Login');
          return;
        } catch (signOutErr) {
          console.error('Sign out error:', signOutErr);
        }
      } else if (err.code === 'unavailable') {
        errorMessage = 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.';
      } else if (err.code === 'unauthenticated') {
        errorMessage = 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
        try {
          await auth().signOut();
          navigation.navigate('Login');
          return;
        } catch (signOutErr) {
          console.error('Sign out error:', signOutErr);
        }
      }
      
      showError(errorMessage);
      
      // Fallback to default emergency contacts
      if (isMountedRef.current) {
        setEmergencyContacts(getDefaultEmergencyContacts());
      }
    } finally {
      loadingStateRef.current.profile = false;
    }
  }, [showError, navigation, createDefaultUserDocument]);

  const loadEmergencyContactsFromData = async (data, userId) => {
    let emergencyContactsToSet = getDefaultEmergencyContacts();
    
    if (data.emergencyContacts) {
      if (Array.isArray(data.emergencyContacts) && data.emergencyContacts.length > 0) {
        // Enhanced validation
        const validContacts = data.emergencyContacts.filter(contact => 
          contact && 
          typeof contact === 'object' && 
          contact.id && 
          contact.name &&
          typeof contact.name === 'string' &&
          contact.name.trim().length > 0
        );
        
        if (validContacts.length > 0) {
          emergencyContactsToSet = validContacts;
        } else {
          // Fix invalid contacts
          await firestore()
            .collection('users')
            .doc(userId)
            .update({ 
              emergencyContacts: getDefaultEmergencyContacts(),
              lastContactsUpdate: firestore.FieldValue.serverTimestamp()
            });
        }
      } else {
        // Fix non-array or empty contacts
        await firestore()
          .collection('users')
          .doc(userId)
          .update({ 
            emergencyContacts: getDefaultEmergencyContacts(),
            lastContactsUpdate: firestore.FieldValue.serverTimestamp()
          });
      }
    } else {
      // Add missing contacts field
      await firestore()
        .collection('users')
        .doc(userId)
        .update({ 
          emergencyContacts: getDefaultEmergencyContacts(),
          lastContactsUpdate: firestore.FieldValue.serverTimestamp()
        });
    }
    
    setEmergencyContacts(emergencyContactsToSet);
    console.log('Emergency contacts loaded:', emergencyContactsToSet.length);
  };

  const loadGuestEmergencyContacts = useCallback(async () => {
    if (loadingStateRef.current.contacts) return;
    
    loadingStateRef.current.contacts = true;
    
    try {
      const storedContacts = await AsyncStorage.getItem('emergencyContacts');
      if (!isMountedRef.current) return;
      
      if (storedContacts) {
        try {
          const parsedContacts = JSON.parse(storedContacts);
          if (Array.isArray(parsedContacts) && parsedContacts.length > 0) {
            const validContacts = parsedContacts.filter(contact => 
              contact && 
              typeof contact === 'object' && 
              contact.id && 
              contact.name
            );
            
            if (validContacts.length > 0) {
              setEmergencyContacts(validContacts);
            } else {
              setEmergencyContacts(getDefaultEmergencyContacts());
            }
          } else {
            setEmergencyContacts(getDefaultEmergencyContacts());
          }
        } catch (parseError) {
          console.error('Error parsing stored contacts:', parseError);
          setEmergencyContacts(getDefaultEmergencyContacts());
        }
      } else {
        setEmergencyContacts(getDefaultEmergencyContacts());
      }
    } catch (err) {
      console.error('Failed to load guest data:', err);
      setEmergencyContacts(getDefaultEmergencyContacts());
    } finally {
      loadingStateRef.current.contacts = false;
    }
  }, []);

  /* -------------------- AUTH LISTENER -------------------- */
  const handleAuthStateChanged = useCallback(async (userState) => {
    setIsLoading(true);
    try {
      if (userState) {
        console.log('User authenticated:', userState.uid);
        setAvatarUrl(userState.photoURL || null);
        setUserProfile((prev) => ({
          ...prev,
          name: userState.displayName || 'Người dùng',
          email: userState.email || '',
        }));
        await loadUserData(userState.uid);
      } else {
        console.log('User not authenticated');
        setAvatarUrl(null);
        setUserProfile({
          name: 'Người dùng',
          level: 1,
          points: 0,
          completedTasks: 0,
          viewedGuides: 0,
          assistantQuestions: 0,
        });
        await loadGuestEmergencyContacts();
      }
    } catch (error) {
      console.error('Auth state change error:', error);
      showError('Đã xảy ra lỗi khi tải dữ liệu.');
      
      // Ensure emergency contacts are set even on error
      if (isMountedRef.current) {
        setEmergencyContacts(getDefaultEmergencyContacts());
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadUserData, loadGuestEmergencyContacts, showError]);

  useEffect(() => {
    isMountedRef.current = true;
    
    const unsubscribe = auth().onAuthStateChanged(handleAuthStateChanged);
    
    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [handleAuthStateChanged]);

  /* -------------------- REFRESH HANDLER -------------------- */
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (user) {
        await loadUserData(user.uid);
      } else {
        await loadGuestEmergencyContacts();
      }
    } catch (error) {
      console.error('Refresh error:', error);
      showError('Không thể làm mới dữ liệu. Vui lòng thử lại.');
      
      // Ensure we have default emergency contacts even if refresh fails
      if (!emergencyContacts || emergencyContacts.length === 0) {
        setEmergencyContacts(getDefaultEmergencyContacts());
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [user, loadUserData, loadGuestEmergencyContacts, showError, emergencyContacts]);

  /* -------------------- EMERGENCY CONTACTS -------------------- */
  const validatePhoneNumber = useCallback((phone) => {
    if (!phone || typeof phone !== 'string') return false;
    
    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    
    // Enhanced validation for multiple countries
    const patterns = [
      /^(\+84|84|0)[3|5|7|8|9][0-9]{8}$/, // Vietnam
      /^(\+1|1)?[2-9][0-9]{2}[2-9][0-9]{2}[0-9]{4}$/, // US/Canada
      /^(\+86|86)?1[3-9][0-9]{9}$/, // China
      /^(\+81|81)?[7-9][0-9]{9}$/, // Japan
      /^(\+82|82)?01[0-9][0-9]{7,8}$/, // South Korea
      /^(\+33|33)?[1-9][0-9]{8}$/, // France
      /^(\+49|49)?1[5-7][0-9]{8,9}$/, // Germany
      /^(\+44|44)?7[0-9]{9}$/, // UK
      /^(\+91|91)?[6-9][0-9]{9}$/, // India
      /^(\+?[1-9]\d{1,14})$/, // General international format
    ];
    
    return patterns.some(pattern => pattern.test(cleanPhone));
  }, []);

  const saveEmergencyContacts = useCallback(async (contacts) => {
    try {
      console.log('Saving emergency contacts:', contacts);
      
      // Enhanced validation
      const validContacts = contacts.filter(contact => 
        contact && 
        typeof contact === 'object' && 
        contact.id && 
        contact.name &&
        typeof contact.name === 'string' &&
        contact.name.trim().length > 0
      );
      
      if (validContacts.length === 0) {
        throw new Error('Không có số khẩn cấp hợp lệ để lưu');
      }
      
      if (user) {
        // Use transaction for consistency
        await firestore().runTransaction(async (transaction) => {
          const userRef = firestore().collection('users').doc(user.uid);
          transaction.update(userRef, { 
            emergencyContacts: validContacts,
            lastContactsUpdate: firestore.FieldValue.serverTimestamp()
          });
        });
        
        console.log('Emergency contacts saved to Firestore');
      } else {
        await AsyncStorage.setItem('emergencyContacts', JSON.stringify(validContacts));
        console.log('Emergency contacts saved to AsyncStorage');
      }
      
      showSuccess('Số khẩn cấp đã được cập nhật.');
    } catch (err) {
      console.error('Saving emergency contacts failed:', err);
      
      let errorMessage = 'Không thể cập nhật số khẩn cấp. Vui lòng thử lại.';
      
      if (err.code === 'permission-denied') {
        errorMessage = 'Không có quyền cập nhật dữ liệu. Vui lòng đăng nhập lại.';
      } else if (err.code === 'unavailable') {
        errorMessage = 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      showError(errorMessage);
    }
  }, [user, showSuccess, showError]);

  const openEditModal = useCallback((contact) => {
    setEditingContact(contact);
    setPhoneInput(contact.phone || '');
    setErrors({});
    setModalVisible(true);
  }, []);

  const handleSaveContact = useCallback(() => {
    const trimmedPhone = phoneInput.trim();
    
    if (!trimmedPhone) {
      setErrors({ phone: 'Vui lòng nhập số điện thoại' });
      return;
    }
    
    if (!validatePhoneNumber(trimmedPhone)) {
      setErrors({ phone: 'Số điện thoại không hợp lệ. Vui lòng kiểm tra định dạng.' });
      return;
    }

    const updatedContacts = emergencyContacts.map((c) =>
      c.id === editingContact.id ? { ...c, phone: trimmedPhone } : c
    );
    
    setEmergencyContacts(updatedContacts);
    saveEmergencyContacts(updatedContacts);
    setModalVisible(false);
    setEditingContact(null);
    setPhoneInput('');
    setErrors({});
  }, [phoneInput, editingContact, emergencyContacts, validatePhoneNumber, saveEmergencyContacts]);

  /* -------------------- ENHANCED PROFILE FUNCTIONS -------------------- */
  const openProfileEditModal = useCallback(() => {
    if (!user) {
      Alert.alert('Đăng nhập', 'Bạn cần đăng nhập để chỉnh sửa thông tin.');
      return;
    }
    setEditingProfile({
      displayName: user.displayName || '',
      email: user.email || '',
      profilePic: null,
      photoURL: user.photoURL || '',
    });
    setErrors({});
    setProfileModalVisible(true);
  }, [user]);

  const handleProfileImagePicker = useCallback(() => {
    Alert.alert(
      'Chọn ảnh đại diện',
      'Bạn muốn chụp ảnh mới hay chọn từ thư viện?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Thư viện', onPress: openImageLibrary },
        { text: 'Chụp ảnh', onPress: openCamera },
      ]
    );
  }, []);

  const openImageLibrary = useCallback(() => {
    const options = {
      mediaType: 'photo',
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.8,
      includeBase64: false,
    };

    launchImageLibrary(options, async (response) => {
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        
        // Check file size (limit to 5MB)
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          showError('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 5MB.');
          return;
        }
        
        // Compress image if needed
        const compressedAsset = await compressImage(asset);
        
        setEditingProfile((prev) => ({
          ...prev,
          profilePic: compressedAsset,
          photoURL: compressedAsset.uri,
        }));
      } else if (response.errorMessage) {
        showError('Lỗi chọn ảnh: ' + response.errorMessage);
      }
    });
  }, [showError]);

  const openCamera = useCallback(() => {
    const options = {
      mediaType: 'photo',
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.8,
      includeBase64: false,
    };

    launchCamera(options, async (response) => {
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        
        // Check file size (limit to 5MB)
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          showError('Ảnh quá lớn. Vui lòng chụp lại với chất lượng thấp hơn.');
          return;
        }
        
        // Compress image if needed
        const compressedAsset = await compressImage(asset);
        
        setEditingProfile((prev) => ({
          ...prev,
          profilePic: compressedAsset,
          photoURL: compressedAsset.uri,
        }));
      } else if (response.errorMessage) {
        showError('Lỗi chụp ảnh: ' + response.errorMessage);
      }
    });
  }, [showError]);

  // Enhanced image compression
  const compressImage = async (asset) => {
    try {
      // If file is already small enough, return as is
      if (!asset.fileSize || asset.fileSize < 1024 * 1024) {
        return asset;
      }

      // For larger files, we could implement compression here
      // For now, just return the original asset
      return asset;
    } catch (error) {
      console.error('Error compressing image:', error);
      return asset;
    }
  };

  const validateProfileData = useCallback(() => {
    const newErrors = {};
    
    if (!editingProfile.displayName.trim()) {
      newErrors.displayName = 'Tên hiển thị không được để trống';
    } else if (editingProfile.displayName.trim().length < 2) {
      newErrors.displayName = 'Tên hiển thị phải có ít nhất 2 ký tự';
    } else if (editingProfile.displayName.trim().length > 50) {
      newErrors.displayName = 'Tên hiển thị không được quá 50 ký tự';
    }
    
    if (editingProfile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editingProfile.email)) {
      newErrors.email = 'Email không hợp lệ';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [editingProfile]);

  const saveProfile = useCallback(async () => {
    if (!validateProfileData()) return;
    
    setIsUpdatingProfile(true);
    try {
      let photoURL = editingProfile.photoURL;
      
      // Upload new image if selected
      if (editingProfile.profilePic && editingProfile.profilePic.uri !== user?.photoURL) {
        try {
          let imageUri = editingProfile.profilePic.uri;
          if (Platform.OS === 'ios' && imageUri.startsWith('file://')) {
            imageUri = imageUri.replace('file://', '');
          }
          
          const timestamp = Date.now();
          const ref = storage().ref(`profilePics/${user.uid}_${timestamp}`);
          
          // Upload with progress tracking
          const uploadTask = ref.putFile(imageUri);
          
          uploadTask.on('state_changed', (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload progress: ${progress}%`);
          });
          
          await uploadTask;
          photoURL = await ref.getDownloadURL();
          
          // Delete old profile picture if exists
          if (user.photoURL && user.photoURL.includes('profilePics/')) {
            try {
              const oldRef = storage().refFromURL(user.photoURL);
              await oldRef.delete();
            } catch (deleteError) {
              console.warn('Could not delete old profile picture:', deleteError);
            }
          }
        } catch (uploadError) {
          console.error('Error uploading profile image:', uploadError);
          throw new Error('Không thể tải lên ảnh đại diện. Vui lòng thử lại.');
        }
      }

      // Update Firebase Auth profile
      await user.updateProfile({
        displayName: editingProfile.displayName.trim(),
        photoURL,
      });
      
      await user.reload();

      // Update Firestore with transaction
      await firestore().runTransaction(async (transaction) => {
        const userRef = firestore().collection('users').doc(user.uid);
        transaction.update(userRef, {
          displayName: editingProfile.displayName.trim(),
          email: editingProfile.email.trim() || null,
          photoURL,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      });

      // Update local state
      setUserProfile((prev) => ({
        ...prev,
        name: editingProfile.displayName.trim(),
      }));
      
      setAvatarUrl(`${photoURL}?t=${Date.now()}`);
      
      showSuccess('Thông tin cá nhân đã được cập nhật!');
      setProfileModalVisible(false);
      setErrors({});
    } catch (error) {
      console.error('Profile update error:', error);
      showError(error.message || 'Không thể cập nhật thông tin. Vui lòng thử lại.');
    } finally {
      setIsUpdatingProfile(false);
    }
  }, [editingProfile, user, validateProfileData, showSuccess, showError]);

  /* -------------------- PREFERENCE HANDLERS -------------------- */
  const handleDialectChange = useCallback((dialect) => {
    updatePreferences({ dialect });
    const nameMap = { north: 'Bắc', central: 'Trung', south: 'Nam' };
    const genderMap = { male: 'Nam', female: 'Nữ' };
    showSuccess(`Đã chọn giọng ${nameMap[dialect]} ${genderMap[preferences.gender]}`);
  }, [preferences.gender, updatePreferences, showSuccess]);

  const handleGenderChange = useCallback((gender) => {
    updatePreferences({ gender });
    const nameMap = { north: 'Bắc', central: 'Trung', south: 'Nam' };
    const genderMap = { male: 'Nam', female: 'Nữ' };
    showSuccess(`Đã chọn giọng ${nameMap[preferences.dialect]} ${genderMap[gender]}`);
  }, [preferences.dialect, updatePreferences, showSuccess]);

  const decreaseFontSize = useCallback(() => {
    const currentIndex = fontSizeAdditions.indexOf(preferences.fontSizeAddition);
    if (currentIndex > 0) {
      updatePreferences({ fontSizeAddition: fontSizeAdditions[currentIndex - 1] });
    }
  }, [preferences.fontSizeAddition, updatePreferences]);

  const increaseFontSize = useCallback(() => {
    const currentIndex = fontSizeAdditions.indexOf(preferences.fontSizeAddition);
    if (currentIndex < fontSizeAdditions.length - 1) {
      updatePreferences({ fontSizeAddition: fontSizeAdditions[currentIndex + 1] });
    }
  }, [preferences.fontSizeAddition, updatePreferences]);

  const handleResetPreferences = useCallback(() => {
    Alert.alert(
      'Đặt lại cài đặt',
      'Bạn có chắc chắn muốn đặt lại tất cả cài đặt về mặc định?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đặt lại',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetToDefaults();
              showSuccess('Đã đặt lại tất cả cài đặt về mặc định.');
            } catch (error) {
              showError('Không thể đặt lại cài đặt. Vui lòng thử lại.');
            }
          },
        },
      ]
    );
  }, [resetToDefaults, showSuccess, showError]);

  /* -------------------- LOGOUT HANDLER -------------------- */
  const handleLogout = useCallback(() => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đồng ý',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsLoading(true);
            await auth().signOut();
            navigateIfExists('Login');
          } catch (error) {
            console.error('Sign-out error:', error);
            showError('Không thể đăng xuất. Vui lòng thử lại.');
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  }, [navigateIfExists, showError]);

  /* -------------------- RENDER HELPERS -------------------- */
  const renderEmergencyContacts = useMemo(
    () =>
      emergencyContacts.map((contact) => (
        <TouchableOpacity 
          key={contact.id} 
          style={styles.contactItem}
          onPress={() => openEditModal(contact)}
          activeOpacity={0.7}
          accessibilityLabel={`Chỉnh sửa ${contact.name}`}
          accessibilityHint="Nhấn để chỉnh sửa số điện thoại khẩn cấp"
        >
          <View style={styles.contactIconContainer}>
            <Ionicons name="call" size={sizes.body} color="#333" />
          </View>
          <View style={styles.contactInfo}>
            <Text style={[styles.contactName, { fontSize: sizes.body }]}>
              {contact.name}
            </Text>
            <Text style={[
              styles.contactStatus, 
              { 
                fontSize: sizes.caption,
                color: contact.phone ? '#666' : '#999'
              }
            ]}>
              {contact.phone || 'Chưa thiết lập'}
            </Text>
            {contact.phone && (
              <View style={styles.contactValidation}>
                <Ionicons 
                  name={validatePhoneNumber(contact.phone) ? "checkmark-circle" : "warning"} 
                  size={12} 
                  color={validatePhoneNumber(contact.phone) ? "#00cc66" : "#ff6b6b"} 
                />
                <Text style={[
                  styles.validationText,
                  { color: validatePhoneNumber(contact.phone) ? "#00cc66" : "#ff6b6b" }
                ]}>
                  {validatePhoneNumber(contact.phone) ? "Hợp lệ" : "Không hợp lệ"}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.editButton}>
            <Ionicons name="pencil" size={sizes.body} color="#6a3de8" />
          </View>
        </TouchableOpacity>
      )),
    [emergencyContacts, sizes, openEditModal, validatePhoneNumber]
  );

  const renderDialectOptions = useMemo(
    () => {
      const options = [
        {
          id: 'north',
          title: 'Bắc',
          subtitle: 'Giọng miền Bắc',
          icon: 'pin',
          color: '#00cc66',
        },
        {
          id: 'central',
          title: 'Trung',
          subtitle: 'Giọng miền Trung',
          icon: 'triangle',
          color: '#FFC107',
        },
        {
          id: 'south',
          title: 'Nam',
          subtitle: 'Giọng miền Nam',
          icon: 'water',
          color: '#7B68EE',
        },
      ];

      return options.map((option) => (
        <TouchableOpacity
          key={option.id}
          style={[
            styles.dialectOption,
            preferences.dialect === option.id && styles.selectedDialect,
          ]}
          onPress={() => handleDialectChange(option.id)}
          activeOpacity={0.7}
          accessibilityLabel={`Chọn ${option.title}`}
          accessibilityState={{ selected: preferences.dialect === option.id }}
        >
          {preferences.dialect === option.id && (
            <View style={styles.checkmarkContainer}>
              <Ionicons name="checkmark-circle" size={sizes.iconSmall} color="#00cc66" />
            </View>
          )}
          <Ionicons name={option.icon} size={sizes.iconLarge} color={option.color} />
          <Text style={[styles.dialectTitle, { color: option.color, fontSize: sizes.body }]}>
            {option.title}
          </Text>
          <Text style={[styles.dialectSubtitle, { fontSize: sizes.caption }]}>
            {option.subtitle}
          </Text>
        </TouchableOpacity>
      ));
    },
    [preferences.dialect, sizes, handleDialectChange]
  );

  const renderGenderOptions = useMemo(
    () => {
      const options = [
        {
          id: 'male',
          title: 'Nam',
          subtitle: 'Giọng nam',
          icon: 'man',
          color: '#2196F3',
        },
        {
          id: 'female',
          title: 'Nữ',
          subtitle: 'Giọng nữ',
          icon: 'woman',
          color: '#E91E63',
        },
      ];

      return options.map((option) => (
        <TouchableOpacity
          key={option.id}
          style={[
            styles.genderOption,
            preferences.gender === option.id && styles.selectedGender,
          ]}
          onPress={() => handleGenderChange(option.id)}
          activeOpacity={0.7}
          accessibilityLabel={`Chọn giọng ${option.title}`}
          accessibilityState={{ selected: preferences.gender === option.id }}
        >
          {preferences.gender === option.id && (
            <View style={styles.checkmarkContainer}>
              <Ionicons name="checkmark-circle" size={sizes.iconSmall} color="#00cc66" />
            </View>
          )}
          <Ionicons name={option.icon} size={sizes.iconLarge} color={option.color} />
          <Text style={[styles.genderTitle, { color: option.color, fontSize: sizes.body }]}>
            {option.title}
          </Text>
          <Text style={[styles.genderSubtitle, { fontSize: sizes.caption }]}>
            {option.subtitle}
          </Text>
        </TouchableOpacity>
      ));
    },
    [preferences.gender, sizes, handleGenderChange]
  );

  /* -------------------- MAIN RENDER -------------------- */
  if (isLoading || preferencesLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor="#00cc66" barStyle="light-content" />
        <Header showBackButton={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00cc66" />
          <Text style={[styles.loadingText, { fontSize: sizes.body }]}>
            Đang tải dữ liệu...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SettingErrorBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor="#00cc66" barStyle="light-content" />
        <Header showBackButton={false} />
        
        <View style={styles.titleContainer}>
          <Text style={[styles.pageTitle, { fontSize: sizes.title }]}>
            Hồ sơ cá nhân
          </Text>
        </View>

        <ScrollView 
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={['#00cc66']}
              tintColor="#00cc66"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Enhanced Profile Section */}
          <View style={styles.card}>
            <View style={styles.profileSection}>
              <TouchableOpacity
                style={styles.profilePicContainer}
                onPress={() =>
                  user
                    ? openProfileEditModal()
                    : Alert.alert(
                        'Đăng nhập',
                        'Bạn cần đăng nhập để tiếp tục',
                        [{ text: 'OK', onPress: () => navigateIfExists('Login') }]
                      )
                }
                activeOpacity={0.8}
                accessibilityLabel="Ảnh đại diện"
                accessibilityHint={user ? "Nhấn để chỉnh sửa thông tin cá nhân" : "Nhấn để đăng nhập"}
              >
                {user && avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.profilePic} />
                ) : (
                  <Ionicons name="person" size={sizes.iconXLarge} color="#fff" />
                )}
                {user && (
                  <View style={styles.editProfileIcon}>
                    <Ionicons name="pencil" size={sizes.iconSmall} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
              
              <View style={styles.profileInfo}>
                <Text style={[styles.userName, { fontSize: sizes.title }]}>
                  {user ? userProfile.name : 'Chưa đăng nhập'}
                </Text>
                
                {user ? (
                  <View style={styles.userStatsContainer}>
                    <View style={styles.levelContainer}>
                      <Text style={[styles.levelText, { fontSize: sizes.body }]}>
                        Cấp độ {userProfile.level}: {levelInfo.title}
                      </Text>
                      <View style={styles.levelBadge}>
                        <Text style={[styles.levelBadgeText, { fontSize: sizes.caption }]}>
                          Lv. {userProfile.level}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.pointsText, { fontSize: sizes.body }]}>
                      Điểm: {userProfile.points.toLocaleString()}
                    </Text>
                    
                    <TouchableOpacity
                      style={styles.editProfileButton}
                      onPress={openProfileEditModal}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="create-outline" size={sizes.iconSmall} color="#00cc66" />
                      <Text style={[styles.editProfileButtonText, { fontSize: sizes.caption }]}>
                        Chỉnh sửa thông tin
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={[styles.userDetail, { fontSize: sizes.body }]}>
                    Vui lòng đăng nhập để truy cập thông tin
                  </Text>
                )}
              </View>
            </View>
            
            {user ? (
              <TouchableOpacity 
                style={styles.logoutButton} 
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Ionicons name="log-out-outline" size={sizes.iconMedium} color="#e74c3c" />
                <Text style={[styles.logoutButtonText, { fontSize: sizes.body }]}>
                  Đăng xuất
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.loginButton}
                onPress={() => navigateIfExists('Login')}
                activeOpacity={0.7}
              >
                <Ionicons name="log-in-outline" size={sizes.iconMedium} color="#00cc66" />
                <Text style={[styles.loginButtonText, { fontSize: sizes.body }]}>
                  Đăng nhập
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* NEW: Dedicated Level Progress Card - Only show if user is logged in */}
          {user && (
            <Animated.View style={[styles.card, styles.levelProgressCard, { transform: [{ scale: scaleAnim }] }]}>
              <View style={styles.levelProgressHeader}>
                <View style={styles.levelIconContainer}>
                  <Ionicons name="trophy" size={sizes.iconLarge} color="#FFD700" />
                </View>
                <View style={styles.levelProgressInfo}>
                  <Text style={[styles.levelProgressTitle, { fontSize: sizes.title }]}>
                    Tiến độ thăng cấp
                  </Text>
                  <Text style={[styles.levelProgressSubtitle, { fontSize: sizes.body }]}>
                    Cấp độ {levelInfo.level}: {levelInfo.title}
                  </Text>
                </View>
              </View>

              {!levelInfo.isMaxLevel ? (
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={[styles.progressText, { fontSize: sizes.body }]}>
                      Tiến độ lên cấp {levelInfo.level + 1}
                    </Text>
                    <Text style={[styles.progressPoints, { fontSize: sizes.body }]}>
                      Còn {levelInfo.pointsForNext.toLocaleString()} điểm
                    </Text>
                  </View>
                  
                  <View style={styles.progressBarContainer}>
                    <Animated.View 
                      style={[
                        styles.progressBarFill,
                        { 
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                            extrapolate: 'clamp',
                          })
                        }
                      ]}
                    />
                    <View style={styles.progressBarOverlay}>
                      <Text style={[styles.progressPercentage, { fontSize: sizes.caption }]}>
                        {Math.round(levelInfo.progress * 100)}%
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.progressLabels}>
                    <Text style={[styles.progressLabel, { fontSize: sizes.caption }]}>
                      {levelInfo.currentLevelPoints.toLocaleString()}
                    </Text>
                    <Text style={[styles.progressLabel, { fontSize: sizes.caption }]}>
                      {levelInfo.nextLevelPoints.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.pointsBreakdown}>
                    <View style={styles.pointsItem}>
                      <Ionicons name="checkmark-circle" size={sizes.iconSmall} color="#00cc66" />
                      <Text style={[styles.pointsItemText, { fontSize: sizes.caption }]}>
                        Hoàn thành nhiệm vụ: +50 điểm
                      </Text>
                    </View>
                    <View style={styles.pointsItem}>
                      <Ionicons name="book" size={sizes.iconSmall} color="#2196F3" />
                      <Text style={[styles.pointsItemText, { fontSize: sizes.caption }]}>
                        Xem hướng dẫn: +20 điểm
                      </Text>
                    </View>
                    <View style={styles.pointsItem}>
                      <Ionicons name="chatbubbles" size={sizes.iconSmall} color="#9C27B0" />
                      <Text style={[styles.pointsItemText, { fontSize: sizes.caption }]}>
                        Hỏi trợ lý: +10 điểm
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.maxLevelContainer}>
                  <View style={styles.maxLevelContent}>
                    <Ionicons name="star" size={sizes.iconXLarge} color="#FFD700" />
                    <Text style={[styles.maxLevelTitle, { fontSize: sizes.title }]}>
                      🎉 Chúc mừng!
                    </Text>
                    <Text style={[styles.maxLevelText, { fontSize: sizes.body }]}>
                      Bạn đã đạt cấp độ tối đa!
                    </Text>
                    <Text style={[styles.maxLevelSubtext, { fontSize: sizes.caption }]}>
                      Tiếp tục sử dụng ứng dụng để tích lũy thêm điểm kinh nghiệm
                    </Text>
                  </View>
                </View>
              )}
            </Animated.View>
          )}

          {/* Emergency Contacts Section */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { fontSize: sizes.title }]}>
                Số điện thoại khẩn cấp
              </Text>
              <TouchableOpacity
                style={styles.helpButton}
                onPress={() => Alert.alert(
                  'Hướng dẫn số khẩn cấp',
                  'Số khẩn cấp được sử dụng khi bạn nhấn nút gọi khẩn cấp ở trang chủ.\n\nVí dụ định dạng hợp lệ:\n• Vietnam: 0987654321\n• Quốc tế: +84987654321\n• Mỹ: +1234567890'
                )}
              >
                <Ionicons name="help-circle-outline" size={sizes.iconMedium} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.sectionSubtitle, { fontSize: sizes.caption }]}>
              Nhấn vào từng mục để chỉnh sửa số điện thoại
            </Text>
            {renderEmergencyContacts}
          </View>

          {/* Display Preferences Section */}
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { fontSize: sizes.title }]}>
              Tùy chọn hiển thị
            </Text>
            <View style={styles.voiceSettingHeader}>
              <Ionicons name="eye" size={sizes.iconLarge} color="#333" />
              <Text style={[styles.voiceSettingHeaderText, { fontSize: sizes.body }]}>
                Chọn tùy chọn hiển thị phù hợp
              </Text>
            </View>
            
            <Text style={[styles.voiceSubtitle, { fontSize: sizes.caption }]}>
              Vùng miền:
            </Text>
            <View style={styles.dialectContainer}>{renderDialectOptions}</View>
            
            <Text style={[styles.voiceSubtitle, { fontSize: sizes.caption, marginTop: sizes.marginMedium }]}>
              Giới tính:
            </Text>
            <View style={styles.genderContainer}>{renderGenderOptions}</View>
            
            <View style={styles.currentSelectionContainer}>
              <Ionicons name="checkmark-circle" size={sizes.iconSmall} color="#00cc66" />
              <Text style={[styles.currentSelectionLabel, { fontSize: sizes.caption }]}>
                Tùy chọn hiện tại: 
              </Text>
              <Text style={[styles.currentSelectionText, { fontSize: sizes.caption }]}>
                {preferences.dialect === 'north' ? 'Miền Bắc' :
                 preferences.dialect === 'central' ? 'Miền Trung' : 'Miền Nam'} - 
                {preferences.gender === 'male' ? ' Nam' : ' Nữ'}
              </Text>
            </View>
          </View>

          {/* Enhanced Font Size Section */}
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { fontSize: sizes.title }]}>
              Cỡ chữ
            </Text>
            <Text style={[styles.fontSizeLabel, { fontSize: sizes.body }]}>
              Điều chỉnh cỡ chữ cho dễ đọc
            </Text>
            
            <View style={styles.sliderContainer}>
              <TouchableOpacity 
                style={[
                  styles.sizeButton,
                  fontSizeIndex === 0 && styles.disabledButton
                ]} 
                onPress={decreaseFontSize}
                disabled={fontSizeIndex === 0}
                activeOpacity={0.7}
              >
                <Text style={[styles.sizeButtonText, { fontSize: sizes.title }]}>−</Text>
              </TouchableOpacity>
              
              <View style={styles.sliderWrapper}>
                <View style={styles.sliderTrack}>
                  <View
                    style={[
                      styles.sliderFill,
                      { width: `${(fontSizeIndex / (fontSizeAdditions.length - 1)) * 100}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.sliderThumb,
                      { left: `${(fontSizeIndex / (fontSizeAdditions.length - 1)) * 100}%` },
                    ]}
                  />
                </View>
                <View style={styles.fontSizeTicks}>
                  {fontSizeLabels.map((label, i) => (
                    <Text
                      key={i}
                      style={[
                        styles.tickLabel,
                        {
                          color: i === fontSizeIndex ? '#00cc66' : '#999',
                          fontWeight: i === fontSizeIndex ? 'bold' : 'normal',
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  ))}
                </View>
                <Text style={[styles.fontSizeValue, { fontSize: sizes.body }]}>
                  {getFontSizeDescription()}
                </Text>
              </View>
              
              <TouchableOpacity 
                style={[
                  styles.sizeButton,
                  fontSizeIndex === fontSizeAdditions.length - 1 && styles.disabledButton
                ]} 
                onPress={increaseFontSize}
                disabled={fontSizeIndex === fontSizeAdditions.length - 1}
                activeOpacity={0.7}
              >
                <Text style={[styles.sizeButtonText, { fontSize: sizes.title }]}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetPreferences}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={sizes.iconMedium} color="#ff6b6b" />
              <Text style={[styles.resetButtonText, { fontSize: sizes.body }]}>
                Đặt lại cài đặt mặc định
              </Text>
            </TouchableOpacity>
          </View>

          {/* Enhanced Statistics Section */}
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { fontSize: sizes.title }]}>
              Thống kê hoạt động
            </Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="checkmark-circle" size={sizes.iconLarge} color="#00cc66" />
                </View>
                <Text style={[styles.statValue, { fontSize: sizes.title }]}>
                  {userProfile.completedTasks}
                </Text>
                <Text style={[styles.statLabel, { fontSize: sizes.caption }]}>
                  Nhiệm vụ hoàn thành
                </Text>
              </View>
              <View style={styles.statItem}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="book" size={sizes.iconLarge} color="#2196F3" />
                </View>
                <Text style={[styles.statValue, { fontSize: sizes.title }]}>
                  {userProfile.viewedGuides}
                </Text>
                <Text style={[styles.statLabel, { fontSize: sizes.caption }]}>
                  Hướng dẫn đã xem
                </Text>
              </View>
              <View style={styles.statItem}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="chatbubbles" size={sizes.iconLarge} color="#9C27B0" />
                </View>
                <Text style={[styles.statValue, { fontSize: sizes.title }]}>
                  {userProfile.assistantQuestions}
                </Text>
                <Text style={[styles.statLabel, { fontSize: sizes.caption }]}>
                  Câu hỏi với trợ lý
                </Text>
              </View>
            </View>
          </View>

          {/* App Information Section */}
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { fontSize: sizes.title }]}>
              Thông tin ứng dụng
            </Text>
            
            <TouchableOpacity
              style={styles.infoItem}
              onPress={() => Alert.alert(
                'Giới thiệu EasyTech',
                'EasyTech là ứng dụng hỗ trợ người cao tuổi sử dụng công nghệ một cách dễ dàng và an toàn.\n\nPhiên bản: 1.0.0\nDành cho: Người cao tuổi và người mới bắt đầu sử dụng smartphone'
              )}
            >
              <Ionicons name="information-circle-outline" size={sizes.iconMedium} color="#00cc66" />
              <Text style={[styles.infoText, { fontSize: sizes.body }]}>
                Giới thiệu ứng dụng
              </Text>
              <Ionicons name="chevron-forward" size={sizes.iconSmall} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.infoItem}
              onPress={() => Alert.alert(
                'Liên hệ hỗ trợ',
                'Email: khanhnam2304.2008@gmail.com\nHotline: 0382066638',
                [
                  { text: 'Đóng', style: 'cancel' },
                  { text: 'Gửi email', onPress: () => Linking.openURL('mailto:khanhnam2304.2008@gmail.com') }
                ]
              )}
            >
              <Ionicons name="help-circle-outline" size={sizes.iconMedium} color="#2196F3" />
              <Text style={[styles.infoText, { fontSize: sizes.body }]}>
                Liên hệ hỗ trợ
              </Text>
              <Ionicons name="chevron-forward" size={sizes.iconSmall} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.infoItem}
              onPress={() => Alert.alert(
                'Đánh giá ứng dụng',
                'Bạn có hài lòng với EasyTech? Hãy để lại đánh giá để giúp chúng tôi cải thiện!',
                [
                  { text: 'Để sau', style: 'cancel' },
                  { text: 'Đánh giá ngay', onPress: () => Linking.openURL('market://details?id=com.easytech') }
                ]
              )}
            >
              <Ionicons name="star-outline" size={sizes.iconMedium} color="#FF9800" />
              <Text style={[styles.infoText, { fontSize: sizes.body }]}>
                Đánh giá ứng dụng
              </Text>
              <Ionicons name="chevron-forward" size={sizes.iconSmall} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Emergency Contact Edit Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={[styles.modalTitle, { fontSize: sizes.title }]}>
                Cập nhật {editingContact?.name}
              </Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { fontSize: sizes.body }]}>
                  Số điện thoại
                </Text>
                <TextInput
                  style={[
                    styles.phoneInput, 
                    { 
                      fontSize: sizes.body,
                      borderColor: errors.phone ? '#e74c3c' : '#00cc66'
                    }
                  ]}
                  value={phoneInput}
                  onChangeText={(text) => {
                    setPhoneInput(text);
                    if (errors.phone) {
                      setErrors(prev => ({ ...prev, phone: null }));
                    }
                  }}
                  placeholder="Nhập số điện thoại (VD: 0123456789)"
                  keyboardType="phone-pad"
                  maxLength={20}
                  onSubmitEditing={handleSaveContact}
                />
                {errors.phone && (
                  <Text style={styles.errorText}>{errors.phone}</Text>
                )}
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setModalVisible(false);
                    setErrors({});
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalButtonText, { fontSize: sizes.body }]}>
                    Hủy
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveContact}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalButtonText, { fontSize: sizes.body }]}>
                    Lưu
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Enhanced Profile Edit Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={profileModalVisible}
          onRequestClose={() => setProfileModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.profileModalContent}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, { fontSize: sizes.title }]}>
                  Chỉnh sửa thông tin cá nhân
                </Text>
                
                <TouchableOpacity
                  style={styles.modalProfilePicContainer}
                  onPress={handleProfileImagePicker}
                  activeOpacity={0.8}
                  disabled={isUpdatingProfile}
                >
                  {editingProfile.photoURL ? (
                    <Image
                      source={{ uri: editingProfile.photoURL }}
                      style={styles.modalProfilePic}
                    />
                  ) : (
                    <Ionicons name="person" size={sizes.iconXLarge} color="#fff" />
                  )}
                  <View style={styles.modalEditIcon}>
                    <Ionicons name="camera" size={sizes.iconMedium} color="#fff" />
                  </View>
                </TouchableOpacity>
                
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { fontSize: sizes.body }]}>
                    Tên hiển thị *
                  </Text>
                  <TextInput
                    style={[
                      styles.profileInput, 
                      { 
                        fontSize: sizes.body,
                        borderColor: errors.displayName ? '#e74c3c' : '#ddd'
                      }
                    ]}
                    value={editingProfile.displayName}
                    onChangeText={(text) => {
                      setEditingProfile((prev) => ({ ...prev, displayName: text }));
                      if (errors.displayName) {
                        setErrors(prev => ({ ...prev, displayName: null }));
                      }
                    }}
                    placeholder="Nhập tên hiển thị"
                    maxLength={50}
                    editable={!isUpdatingProfile}
                  />
                  {errors.displayName && (
                    <Text style={styles.errorText}>{errors.displayName}</Text>
                  )}
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { fontSize: sizes.body }]}>
                    Email (tùy chọn)
                  </Text>
                  <TextInput
                    style={[
                      styles.profileInput, 
                      { 
                        fontSize: sizes.body,
                        borderColor: errors.email ? '#e74c3c' : '#ddd'
                      }
                    ]}
                    value={editingProfile.email}
                    onChangeText={(text) => {
                      setEditingProfile((prev) => ({ ...prev, email: text }));
                      if (errors.email) {
                        setErrors(prev => ({ ...prev, email: null }));
                      }
                    }}
                    placeholder="Nhập email"
                    keyboardType="email-address"
                    maxLength={100}
                    editable={!isUpdatingProfile}
                  />
                  {errors.email && (
                    <Text style={styles.errorText}>{errors.email}</Text>
                  )}
                </View>
                
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setProfileModalVisible(false);
                      setErrors({});
                    }}
                    disabled={isUpdatingProfile}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalButtonText, { fontSize: sizes.body }]}>
                      Hủy
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.saveButton,
                      isUpdatingProfile && styles.disabledButton,
                    ]}
                    onPress={saveProfile}
                    disabled={isUpdatingProfile}
                    activeOpacity={0.7}
                  >
                    {isUpdatingProfile ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.modalButtonText, { fontSize: sizes.body }]}>
                        Lưu
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <TabBar selectedTab="Setting" onTabPress={handleTabPress} />
      </SafeAreaView>
    </SettingErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#00cc66',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  titleContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  pageTitle: {
    fontWeight: 'bold',
    color: '#333',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // NEW: Enhanced Level Progress Card Styles
  levelProgressCard: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderWidth: 2,
    borderColor: '#00cc66',
  },
  levelProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  levelIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  levelProgressInfo: {
    flex: 1,
  },
  levelProgressTitle: {
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  levelProgressSubtitle: {
    color: '#666',
    fontWeight: '500',
  },
  progressSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    color: '#333',
    fontWeight: '600',
  },
  progressPoints: {
    color: '#00cc66',
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00cc66',
    borderRadius: 6,
    position: 'relative',
  },
  progressBarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercentage: {
    color: '#fff',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressLabel: {
    color: '#666',
    fontWeight: '500',
  },
  pointsBreakdown: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  pointsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  pointsItemText: {
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  maxLevelContainer: {
    backgroundColor: '#fff9e6',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  maxLevelContent: {
    alignItems: 'center',
  },
  maxLevelTitle: {
    color: '#f39c12',
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  maxLevelText: {
    color: '#333',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  maxLevelSubtext: {
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#00cc66',
    flex: 1,
  },
  helpButton: {
    padding: 4,
  },
  sectionSubtitle: {
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profilePicContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#00cc66',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profilePic: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  editProfileIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#007BFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userStatsContainer: {
    marginBottom: 8,
  },
  userDetail: {
    color: '#666',
    marginBottom: 2,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  levelText: {
    color: '#333',
    fontWeight: '600',
    flex: 1,
  },
  levelBadge: {
    backgroundColor: '#00cc66',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  levelBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  pointsText: {
    color: '#666',
    marginBottom: 8,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  editProfileButtonText: {
    color: '#00cc66',
    marginLeft: 4,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    marginTop: 8,
  },
  logoutButtonText: {
    color: '#e74c3c',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  loginButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#00cc66',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#00cc66',
  },
  contactIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  contactStatus: {
    color: '#666',
  },
  contactValidation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  validationText: {
    fontSize: 10,
    marginLeft: 4,
    fontWeight: '500',
  },
  editButton: {
    padding: 8,
    backgroundColor: '#f0f7ff',
    borderRadius: 6,
  },
  voiceSettingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  voiceSettingHeaderText: {
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#333',
  },
  voiceSubtitle: {
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    marginTop: 8,
  },
  dialectContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dialectOption: {
    width: screenWidth > 400 ? '31%' : '30%',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    position: 'relative',
    minHeight: 80,
    justifyContent: 'center',
  },
  selectedDialect: {
    borderWidth: 2,
    borderColor: '#00cc66',
    backgroundColor: '#f0fff0',
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  genderOption: {
    width: '45%',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    position: 'relative',
    minHeight: 80,
    justifyContent: 'center',
  },
  selectedGender: {
    borderWidth: 2,
    borderColor: '#00cc66',
    backgroundColor: '#f0fff0',
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  dialectTitle: {
    fontWeight: 'bold',
    marginTop: 6,
  },
  dialectSubtitle: {
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  genderTitle: {
    fontWeight: 'bold',
    marginTop: 6,
  },
  genderSubtitle: {
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  currentSelectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#00cc66',
  },
  currentSelectionLabel: {
    color: '#666',
    fontWeight: '600',
    marginLeft: 8,
  },
  currentSelectionText: {
    color: '#00cc66',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  fontSizeLabel: {
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  sizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#00cc66',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sizeButtonText: {
    fontWeight: 'bold',
    color: '#00cc66',
  },
  disabledButton: {
    opacity: 0.4,
  },
  sliderWrapper: {
    flex: 1,
    marginHorizontal: 16,
  },
  fontSizeTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  tickLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  sliderTrack: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    position: 'relative',
  },
  sliderFill: {
    height: 6,
    backgroundColor: '#00cc66',
    borderRadius: 3,
    position: 'absolute',
    left: 0,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#00cc66',
    position: 'absolute',
    top: -7,
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  fontSizeValue: {
    color: '#00cc66',
    alignSelf: 'flex-end',
    marginTop: 8,
    fontWeight: '600',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcccb',
  },
  resetButtonText: {
    color: '#ff6b6b',
    fontWeight: '600',
    marginLeft: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    padding: 8,
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statValue: {
    fontWeight: 'bold',
    color: '#00cc66',
    marginBottom: 4,
  },
  statLabel: {
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    color: '#333',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  profileModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalProfilePicContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#00cc66',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalProfilePic: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  modalEditIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#007BFF',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  profileInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
  },
  phoneInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
  },
  phoneHelp: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  saveButton: {
    backgroundColor: '#00cc66',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default Setting;