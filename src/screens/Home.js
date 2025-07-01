import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  Linking,
  Modal,
  Platform,
  PermissionsAndroid,
  AppState,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TabBar from './TabBar';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { UserPreferences } from './UserPreferences';
import Header from './Header';

const Home = () => {
  const navigation = useNavigation();
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState(null);
  const { currentFontSize, getScaledSize, loading: preferencesLoading } = UserPreferences();
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [countdown, setCountdown] = useState(10);
  const [completedTasksCount, setCompletedTasksCount] = useState(0);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  // Refs for cleanup and race condition prevention
  const autoDialTimeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const isMountedRef = useRef(true);
  const isEmergencyInProgressRef = useRef(false);
  const loadingStateRef = useRef({
    tasks: false,
    contacts: false,
    profile: false,
  });

  /*** Helper functions reordered so that they're defined before use ***/

  // Guest emergency contacts loader (must come before loadEmergencyContacts)
  const loadGuestEmergencyContacts = useCallback(async () => {
    const getDefaultEmergencyContacts = () => [
      { id: 1, name: 'Liên hệ khẩn cấp 1', phone: null },
      { id: 2, name: 'Liên hệ khẩn cấp 2', phone: null },
      { id: 3, name: 'Liên hệ khẩn cấp 3', phone: null },
    ];

    try {
      const storedContacts = await AsyncStorage.getItem('emergencyContacts');
      if (!isMountedRef.current) return;

      if (storedContacts) {
        try {
          const parsedContacts = JSON.parse(storedContacts);
          if (Array.isArray(parsedContacts) && parsedContacts.length > 0) {
            const validContacts = parsedContacts.filter(
              (contact) =>
                contact &&
                typeof contact === 'object' &&
                contact.id &&
                contact.name
            );

            if (validContacts.length > 0) {
              setEmergencyContacts(validContacts);
              return;
            }
          }
        } catch (parseError) {
          console.error('Error parsing stored contacts:', parseError);
        }
      }

      setEmergencyContacts(getDefaultEmergencyContacts());
    } catch (error) {
      console.error('Error loading guest emergency contacts:', error);
      setEmergencyContacts(getDefaultEmergencyContacts());
    }
  }, []);

  // General emergency contacts loader (calls loadGuestEmergencyContacts when userId is null)
  const loadEmergencyContacts = useCallback(
    async (userId = null) => {
      if (loadingStateRef.current.contacts) return;

      loadingStateRef.current.contacts = true;
      setIsLoadingContacts(true);

      const getDefaultEmergencyContacts = () => [
        { id: 1, name: 'Liên hệ khẩn cấp 1', phone: null },
        { id: 2, name: 'Liên hệ khẩn cấp 2', phone: null },
        { id: 3, name: 'Liên hệ khẩn cấp 3', phone: null },
      ];

      try {
        if (userId) {
          const docSnap = await firestore()
            .collection('users')
            .doc(userId)
            .get();
          if (!isMountedRef.current) return;

          let contactsToSet = getDefaultEmergencyContacts();

          if (docSnap.exists) {
            const data = docSnap.data();

            if (
              data?.emergencyContacts &&
              Array.isArray(data.emergencyContacts)
            ) {
              const validContacts = data.emergencyContacts.filter(
                (contact) =>
                  contact &&
                  typeof contact === 'object' &&
                  contact.id &&
                  contact.name &&
                  typeof contact.name === 'string'
              );

              if (validContacts.length > 0) {
                contactsToSet = validContacts;
              }
            }
          }

          setEmergencyContacts(contactsToSet);
        } else {
          await loadGuestEmergencyContacts();
        }
      } catch (error) {
        console.error('Error loading emergency contacts:', error);
        if (isMountedRef.current) {
          setEmergencyContacts(getDefaultEmergencyContacts());
        }
      } finally {
        setIsLoadingContacts(false);
        loadingStateRef.current.contacts = false;
      }
    },
    [loadGuestEmergencyContacts]
  );

  // Close emergency modal (must come before handleAutoDial and handleManualDial)
  const closeEmergencyModal = useCallback(() => {
    // Clear all timers safely
    if (autoDialTimeoutRef.current) {
      clearTimeout(autoDialTimeoutRef.current);
      autoDialTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    
    // Reset states
    setEmergencyModalVisible(false);
    setCountdown(10);
    isEmergencyInProgressRef.current = false;
  }, []);

  // Core auto-dial logic
  const handleAutoDial = useCallback(async (validContacts) => {
    if (!isMountedRef.current || !validContacts || validContacts.length === 0) {
      closeEmergencyModal();
      return;
    }
  
    console.log(`Starting emergency call sequence for ${validContacts.length} contacts...`);
  
    for (let i = 0; i < validContacts.length && isMountedRef.current && isEmergencyInProgressRef.current; i++) {
      const contact = validContacts[i];
      
      try {
        const cleanPhone = contact.phone.replace(/[\s\-\(\)\+]/g, '');
        let phoneNumber;
        
        if (cleanPhone.startsWith('84')) {
          phoneNumber = `tel:+${cleanPhone}`;
        } else if (cleanPhone.startsWith('+')) {
          phoneNumber = `tel:${cleanPhone}`;
        } else {
          phoneNumber = `tel:${cleanPhone}`;
        }
  
        console.log(`Attempting contact ${i + 1}/${validContacts.length}: ${contact.name} - ${phoneNumber}`);
  
        const supported = await Linking.canOpenURL(phoneNumber);
  
        if (supported && isMountedRef.current && isEmergencyInProgressRef.current) {
          await Linking.openURL(phoneNumber);
          closeEmergencyModal();
  
          console.log(`✅ Emergency call initiated to: ${contact.name}`);
  
          // Log emergency call
          if (user?.uid) {
            firestore()
              .collection('users')
              .doc(user.uid)
              .update({
                lastEmergencyCall: {
                  contactName: contact.name,
                  phoneNumber: contact.phone,
                  timestamp: firestore.FieldValue.serverTimestamp(),
                  type: 'auto',
                },
              })
              .catch((error) => {
                console.error('Error logging emergency call:', error);
              });
          }
          return;
        } else {
          console.warn(`❌ Cannot call ${contact.name}: ${phoneNumber}`);
          
          if (i < validContacts.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }
        }
      } catch (error) {
        console.error(`❌ Error calling ${contact.name}:`, error);
        
        if (i < validContacts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
      }
    }
  
    // All contacts failed
    if (isMountedRef.current) {
      console.error('❌ All emergency contacts failed');
      closeEmergencyModal();
  
      Alert.alert(
        'Lỗi cuộc gọi khẩn cấp',
        `Không thể thực hiện cuộc gọi đến tất cả ${validContacts.length} số khẩn cấp.\n\nVui lòng:\n• Kiểm tra quyền gọi điện\n• Xác nhận số điện thoại đúng\n• Thử gọi thủ công từ danh bạ`,
        [
          { text: 'Mở Cài đặt', onPress: () => Linking.openSettings() },
          { text: 'Thử lại', onPress: () => handleEmergencyPress() },
          { text: 'Đóng', style: 'cancel' },
        ]
      );
    }
  }, [closeEmergencyModal, user, handleEmergencyPress]);

  // Manual dial (called when user taps a contact in the modal)
  const handleManualDial = useCallback(
    async (contact) => {
      if (!isValidPhoneNumber(contact.phone)) {
        Alert.alert('Lỗi', 'Số điện thoại không hợp lệ');
        return;
      }

      try {
        const cleanPhone = contact.phone.replace(/[\s\-\(\)\+]/g, '');
        let phoneNumber;
        if (cleanPhone.startsWith('84')) {
          phoneNumber = `tel:+${cleanPhone}`;
        } else if (cleanPhone.startsWith('+')) {
          phoneNumber = `tel:${cleanPhone}`;
        } else {
          phoneNumber = `tel:${cleanPhone}`;
        }

        const supported = await Linking.canOpenURL(phoneNumber);

        if (supported) {
          await Linking.openURL(phoneNumber);
          closeEmergencyModal();

          // Log manual emergency call
          if (user) {
            firestore()
              .collection('users')
              .doc(user.uid)
              .update({
                lastEmergencyCall: {
                  contactName: contact.name,
                  phoneNumber: contact.phone,
                  timestamp: firestore.FieldValue.serverTimestamp(),
                  type: 'manual',
                },
              })
              .catch((error) => {
                console.error('Error logging manual emergency call:', error);
              });
          }

          console.log(`Manual emergency call to: ${contact.name}`);
        } else {
          Alert.alert(
            'Lỗi',
            `Thiết bị không hỗ trợ gọi điện.\nSố: ${contact.phone}`
          );
        }
      } catch (error) {
        console.error('Error making manual call:', error);
        Alert.alert('Lỗi cuộc gọi', `Không thể gọi đến ${contact.name}.\nSố: ${contact.phone}`);
      }
    },
    [closeEmergencyModal, user]
  );

  /*** End of reordered helper functions ***/

  // Enhanced phone number validation for international support
  const isValidPhoneNumber = useCallback((phone) => {
    if (!phone || typeof phone !== 'string') return false;

    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');

    // Vietnam patterns
    const vietnamMobileRegex = /^(03|05|07|08|09)[0-9]{8}$/;
    const vietnamLandlineRegex = /^(02)[0-9]{8}$/;
    const vietnamInternationalRegex = /^84(3|5|7|8|9)[0-9]{8}$/;

    // International patterns (basic validation)
    const internationalRegex = /^(\+?[1-9]\d{7,14})$/;

    return (
      vietnamMobileRegex.test(cleanPhone) ||
      vietnamLandlineRegex.test(cleanPhone) ||
      vietnamInternationalRegex.test(cleanPhone) ||
      internationalRegex.test(cleanPhone)
    );
  }, []);

  // Enhanced emergency call handler with better validation
  const handleEmergencyPress = useCallback(async () => {
    // ✅ FIX: Prevent multiple concurrent calls
    if (isEmergencyInProgressRef.current) {
      console.log('Emergency call already in progress, ignoring...');
      return;
    }
  
    // Validate contacts before proceeding
    if (!emergencyContacts || emergencyContacts.length === 0) {
      Alert.alert(
        'Số khẩn cấp chưa thiết lập',
        'Bạn chưa thiết lập số điện thoại khẩn cấp. Vui lòng cài đặt trước khi sử dụng.',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Đi đến Cài đặt',
            onPress: () => navigateIfExists('Setting'),
          },
        ]
      );
      return;
    }
  
    const validContacts = emergencyContacts.filter((contact) =>
      isValidPhoneNumber(contact.phone)
    );
  
    if (validContacts.length === 0) {
      Alert.alert(
        'Số khẩn cấp không hợp lệ',
        `Không có số khẩn cấp hợp lệ trong ${emergencyContacts.length} số đã lưu.\n\nVí dụ định dạng đúng:\n• 0987654321 (di động Việt Nam)\n• 0283123456 (cố định Việt Nam)\n• +84987654321 (quốc tế)\n• +1234567890 (quốc tế khác)`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Đi đến Cài đặt',
            onPress: () => navigateIfExists('Setting'),
          },
        ]
      );
      return;
    }
  
    const hasPermission = await checkCallPermission();
    if (!hasPermission) {
      Alert.alert(
        'Cần quyền gọi điện',
        'Ứng dụng cần quyền gọi điện để thực hiện cuộc gọi khẩn cấp tự động. Vui lòng cấp quyền trong cài đặt điện thoại.',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Mở Cài đặt', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
  
    // ✅ FIX: Set flag before any async operations
    isEmergencyInProgressRef.current = true;
    
    try {
      setEmergencyModalVisible(true);
      setCountdown(10);
  
      // Clear any existing timers before setting new ones
      if (autoDialTimeoutRef.current) {
        clearTimeout(autoDialTimeoutRef.current);
        autoDialTimeoutRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
  
      // Start countdown
      const interval = setInterval(() => {
        if (!isMountedRef.current) {
          clearInterval(interval);
          return;
        }
        
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            if (countdownIntervalRef.current === interval) {
              countdownIntervalRef.current = null;
            }
            
            // Start auto dial after countdown
            setTimeout(() => {
              if (isMountedRef.current && isEmergencyInProgressRef.current) {
                handleAutoDial(validContacts);
              }
            }, 100);
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
  
      countdownIntervalRef.current = interval;
      
    } catch (error) {
      console.error('Error starting emergency call:', error);
      isEmergencyInProgressRef.current = false;
      closeEmergencyModal();
      
      Alert.alert(
        'Lỗi',
        'Không thể khởi tạo cuộc gọi khẩn cấp. Vui lòng thử lại.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  }, [
    emergencyContacts,
    isValidPhoneNumber,
    navigateIfExists,
    handleAutoDial,
    closeEmergencyModal
  ]);

  // Check Android call permission
  const checkCallPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.CALL_PHONE
        );

        if (hasPermission) return true;

        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CALL_PHONE,
          {
            title: 'Quyền gọi điện khẩn cấp',
            message:
              'EasyTech cần quyền gọi điện để thực hiện cuộc gọi khẩn cấp tự động',
            buttonNeutral: 'Hỏi sau',
            buttonNegative: 'Từ chối',
            buttonPositive: 'Đồng ý',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Permission error:', err);
        return false;
      }
    }
    return true;
  };

  // Guest task data loader
  const loadGuestTaskData = useCallback(async () => {
    try {
      const savedCompletedTasks = await AsyncStorage.getItem('completedTasks');
      if (!isMountedRef.current) return;

      if (savedCompletedTasks) {
        try {
          const tasksArray = JSON.parse(savedCompletedTasks);
          if (Array.isArray(tasksArray)) {
            const uniqueTasks = new Set(
              tasksArray.filter(
                (task) => task && typeof task === 'string' && task.trim().length > 0
              )
            );
            setCompletedTasksCount(Math.min(uniqueTasks.size, 3));
          } else {
            setCompletedTasksCount(0);
          }
        } catch (parseError) {
          console.error('Error parsing completed tasks:', parseError);
          setCompletedTasksCount(0);
        }
      } else {
        setCompletedTasksCount(0);
      }
    } catch (error) {
      console.error('Error loading guest task data:', error);
      setCompletedTasksCount(0);
    }
  }, []);

  // Guest data loader (tasks + contacts)
  const loadGuestData = useCallback(async () => {
    try {
      await Promise.all([loadGuestTaskData(), loadGuestEmergencyContacts()]);
    } catch (error) {
      console.error('Error loading guest data:', error);
    }
  }, [loadGuestTaskData, loadGuestEmergencyContacts]);

  // Enhanced user profile loading
  const loadUserProfile = useCallback(
    async (userId) => {
      if (!userId || loadingStateRef.current.profile) return;

      loadingStateRef.current.profile = true;
      try {
        const docSnap = await firestore().collection('users').doc(userId).get();
        if (!isMountedRef.current) return;

        if (docSnap.exists) {
          const data = docSnap.data();
          const displayName =
            data?.displayName ||
            data?.name ||
            auth().currentUser?.displayName ||
            'Người dùng';
          setUserName(displayName);
        } else {
          setUserName(auth().currentUser?.displayName || 'Người dùng');
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        if (isMountedRef.current) {
          setUserName(auth().currentUser?.displayName || 'Người dùng');
        }
      } finally {
        loadingStateRef.current.profile = false;
      }
    },
    []
  );

  // Enhanced task data loading with proper progress calculation
  const loadUserTaskData = useCallback(async (userId) => {
    if (!userId || loadingStateRef.current.tasks) return;
  
    loadingStateRef.current.tasks = true;
    setIsLoadingTasks(true);
  
    try {
      const docSnap = await firestore().collection('users').doc(userId).get();
      if (!isMountedRef.current) return;
  
      let finalCount = 0;
  
      if (docSnap.exists) {
        const data = docSnap.data();
        finalCount = getCompletedTaskCount(data);
  
        // ✅ FIX: Only update if there's a discrepancy
        const currentStoredCount = data.completedTasksCount;
        if (currentStoredCount !== finalCount) {
          // Use transaction to prevent race conditions
          firestore().runTransaction(async (transaction) => {
            const docRef = firestore().collection('users').doc(userId);
            const freshDoc = await transaction.get(docRef);
            
            if (freshDoc.exists) {
              transaction.update(docRef, {
                completedTasksCount: finalCount,
                lastProgressUpdate: firestore.FieldValue.serverTimestamp(),
              });
            }
          }).catch((error) => {
            console.error('Error updating progress count:', error);
          });
        }
      }
  
      setCompletedTasksCount(finalCount);
    } catch (error) {
      console.error('Error loading user task data:', error);
      if (isMountedRef.current) {
        setCompletedTasksCount(0);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingTasks(false);
        loadingStateRef.current.tasks = false;
      }
    }
  }, [getCompletedTaskCount]);

  // Auth state handler with race condition protection
  const onAuthStateChanged = useCallback(
    (userState) => {
      if (!isMountedRef.current) return;

      setUser(userState);
      if (initializing) setInitializing(false);

      if (userState) {
        // Load data in parallel but track each operation
        Promise.all([
          loadUserTaskData(userState.uid),
          loadUserProfile(userState.uid),
          loadEmergencyContacts(userState.uid),
        ]).catch((error) => {
          console.error('Error loading user data:', error);
        });
      } else {
        setUserName(null);
        loadGuestData();
      }
    },
    [initializing, loadUserProfile, loadUserTaskData, loadEmergencyContacts, loadGuestData]
  );

  // AppState change handler
  const handleAppStateChange = useCallback(
    (nextAppState) => {
      if (nextAppState === 'active' && user) {
        // Refresh data when app becomes active
        loadUserTaskData(user.uid);
      }
    },
    [user, loadUserTaskData]
  );

  // Component lifecycle management
  useEffect(() => {
    isMountedRef.current = true;
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
  
    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );
  
    return () => {
      isMountedRef.current = false;
      subscriber();
      appStateSubscription?.remove();
      
      // ✅ FIX: Proper cleanup của tất cả timers
      if (autoDialTimeoutRef.current) {
        clearTimeout(autoDialTimeoutRef.current);
        autoDialTimeoutRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      isEmergencyInProgressRef.current = false;
      
      // Clear loading states
      Object.keys(loadingStateRef.current).forEach(key => {
        loadingStateRef.current[key] = false;
      });
    };
  }, [onAuthStateChanged, handleAppStateChange]);

  // Focus effect for refreshing data
  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        loadUserTaskData(user.uid);
      } else {
        loadGuestTaskData();
      }
    }, [user?.uid, loadUserTaskData, loadGuestTaskData])
  );
  const getCompletedTaskCount = useCallback((data) => {
    if (!data || typeof data !== 'object') {
      return 0;
    }
  
    // Method 1: Use completedTasks array (primary source)
    if (data.completedTasks && Array.isArray(data.completedTasks)) {
      const uniqueTasks = new Set(
        data.completedTasks.filter(task => 
          task && typeof task === 'string' && task.trim().length > 0
        )
      );
      return Math.min(uniqueTasks.size, 3); // Cap at 3 for daily display
    }
    
    // Method 2: Fallback to individual task flags
    const taskFlags = ['task1Completed', 'task2Completed', 'task3Completed'];
    const flagCompletedCount = taskFlags.filter(flag => data[flag] === true).length;
    
    // Method 3: Fallback to completedTasksCount field
    const countField = typeof data.completedTasksCount === 'number' 
      ? Math.min(data.completedTasksCount, 3) 
      : 0;
    
    // Return the highest valid count
    return Math.max(flagCompletedCount, countField);
  }, []);
  // Navigation helper
  const navigateIfExists = useCallback(
    (route) => {
      try {
        navigation.navigate(route);
      } catch (error) {
        console.warn(`Navigation error for route ${route}:`, error);
        Alert.alert('Lỗi', `Không thể điều hướng đến ${route}. Vui lòng thử lại.`);
      }
    },
    [navigation]
  );

  const handleTabPress = useCallback(
    (tab) => {
      navigateIfExists(tab);
    },
    [navigateIfExists]
  );

  // Memoized date calculations
  const dateInfo = useMemo(() => {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const daysOfWeek = [
      'Chủ Nhật',
      'Thứ Hai',
      'Thứ Ba',
      'Thứ Tư',
      'Thứ Năm',
      'Thứ Sáu',
      'Thứ Bảy',
    ];
    const dayOfWeek = daysOfWeek[today.getDay()];

    const getGreeting = () => {
      const hour = today.getHours();
      if (hour < 12) return 'Chào buổi sáng';
      if (hour < 18) return 'Chào buổi chiều';
      return 'Chào buổi tối';
    };

    return {
      day: day.toString().padStart(2, '0'),
      month: month.toString().padStart(2, '0'),
      year,
      dayOfWeek,
      greeting: getGreeting(),
    };
  }, []);

  // Memoized progress calculations
  const progressInfo = useMemo(() => {
    const isCompleted = completedTasksCount >= 3;
    const progressPercentage = isCompleted
      ? 100
      : (completedTasksCount / 3) * 100;

    return {
      isCompleted,
      progressPercentage,
      completedTasksCount,
    };
  }, [completedTasksCount]);

  // Show loading state
  if (initializing || preferencesLoading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <Text style={{ fontSize: currentFontSize }}>Đang tải...</Text>
      </View>
    );
  }

  // Progress Circle Component
  const ProgressCircle = ({
    size = 60,
    strokeWidth = 6,
    progress = 0,
    isCompleted = false,
  }) => {
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;

    const totalDots = 12;
    const completedDots = Math.round((progress / 100) * totalDots);

    const dots = Array.from({ length: totalDots }, (_, index) => {
      const angle = (index * 360) / totalDots - 90;
      const radian = (angle * Math.PI) / 180;
      const x = center + radius * Math.cos(radian) - strokeWidth / 2;
      const y = center + radius * Math.sin(radian) - strokeWidth / 2;

      return {
        x,
        y,
        isActive: index < completedDots || isCompleted,
      };
    });

    return (
      <View style={[styles.progressCircleContainer, { width: size, height: size }]}>
        <View
          style={[
            styles.progressCircleBg,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 2,
              borderColor: '#e0e0e0',
            },
          ]}
        />
        {dots.map((dot, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              {
                width: strokeWidth,
                height: strokeWidth,
                borderRadius: strokeWidth / 2,
                backgroundColor: dot.isActive ? '#00cc66' : '#e0e0e0',
                position: 'absolute',
                left: dot.x,
                top: dot.y,
              },
            ]}
          />
        ))}
        <View style={styles.progressTextContainer}>
          <Text
            style={[
              styles.progressText,
              {
                fontSize: getScaledSize(14),
                color: isCompleted ? '#00cc66' : '#999999',
                fontWeight: isCompleted ? 'bold' : 'normal',
              },
            ]}
          >
            {completedTasksCount}/3
          </Text>
        </View>
      </View>
    );
  };

  // Dynamic styles
  const dynamicStyles = StyleSheet.create({
    pageTitleText: {
      fontSize: getScaledSize(16),
      fontWeight: 'bold',
    },
    greetingText: {
      fontSize: getScaledSize(18),
      fontWeight: 'bold',
      color: '#008800',
    },
    dateText: {
      fontSize: getScaledSize(14),
      color: '#757575',
      marginTop: 4,
    },
    progressInfoText: {
      fontSize: getScaledSize(14),
      color: progressInfo.isCompleted ? '#00cc66' : '#666666',
      fontWeight: progressInfo.isCompleted ? 'bold' : 'normal',
      marginBottom: 8,
    },
    taskText: {
      fontSize: getScaledSize(14),
      color: '#333',
    },
    taskNumber: {
      fontSize: getScaledSize(14),
      color: '#fff',
      fontWeight: 'bold',
    },
    authButtonText: {
      fontSize: getScaledSize(16),
      color: '#fff',
      fontWeight: 'bold',
    },
    emergencyTitle: {
      fontSize: getScaledSize(16),
      color: '#fff',
      fontWeight: 'bold',
    },
    emergencySubtitle: {
      fontSize: getScaledSize(12),
      color: '#fff',
      opacity: 0.8,
    },
    featureText: {
      fontSize: getScaledSize(14),
      marginTop: 8,
      textAlign: 'center',
      color: '#333',
    },
    modalTitle: {
      fontSize: getScaledSize(18),
      fontWeight: 'bold',
      color: '#333',
      marginBottom: 16,
      textAlign: 'center',
    },
    countdownText: {
      fontSize: getScaledSize(16),
      color: '#ff4d4d',
      fontWeight: 'bold',
      marginBottom: 16,
      textAlign: 'center',
    },
    contactButtonText: {
      fontSize: getScaledSize(14),
      color: '#333',
      marginLeft: 8,
    },
    priorityText: {
      fontSize: getScaledSize(10),
      color: '#fff',
      fontWeight: 'bold',
    },
    cancelButtonText: {
      fontSize: getScaledSize(14),
      color: '#fff',
      fontWeight: 'bold',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#00cc66" barStyle="light-content" />
      <Header showBackButton={false} />

      <View style={styles.pageTitle}>
        <Text style={dynamicStyles.pageTitleText}>Trang chủ</Text>
      </View>

      <View style={styles.greetingCard}>
        <View style={styles.greetingRow}>
          <View style={styles.sunIcon}>
            <Ionicons
              name="sunny"
              size={getScaledSize(24)}
              color="#FFD700"
            />
          </View>
          <View style={styles.greetingTextContainer}>
            <Text style={dynamicStyles.greetingText}>
              {dateInfo.greeting},{' '}
              {user
                ? userName ||
                  (user.email ? user.email.split('@')[0] : 'Người Dùng')
                : 'Người Dùng'}
              !
            </Text>
            <Text style={dynamicStyles.dateText}>
              {`${dateInfo.dayOfWeek}, ngày ${dateInfo.day} tháng ${dateInfo.month}, ${dateInfo.year}`}
            </Text>
          </View>
        </View>

        {user && (
          <View
            style={[
              styles.progressContainer,
              progressInfo.isCompleted && styles.progressContainerCompleted,
            ]}
          >
            <ProgressCircle
              size={60}
              strokeWidth={6}
              progress={progressInfo.progressPercentage}
              isCompleted={progressInfo.isCompleted}
            />
            <View style={styles.progressInfo}>
              <Text style={dynamicStyles.progressInfoText}>
                {progressInfo.isCompleted
                  ? '🎉 Chúc mừng! Bạn đã hoàn thành tất cả nhiệm vụ hôm nay!'
                  : `Bạn đã hoàn thành ${progressInfo.completedTasksCount}/3 nhiệm vụ hôm nay!`}
              </Text>
              <View style={styles.taskRow}>
                <Text style={dynamicStyles.taskText}>
                  {progressInfo.isCompleted ? 'Tất cả ' : 'Hôm nay có '}
                </Text>
                <View
                  style={[
                    styles.taskNumberContainer,
                    {
                      backgroundColor: progressInfo.isCompleted
                        ? '#00cc66'
                        : '#cccccc',
                    },
                  ]}
                >
                  <Text style={dynamicStyles.taskNumber}>3</Text>
                </View>
                <Text style={dynamicStyles.taskText}>
                  {progressInfo.isCompleted
                    ? ' nhiệm vụ đã hoàn thành!'
                    : ' nhiệm vụ'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {!user && (
          <View style={styles.authContainer}>
            <TouchableOpacity
              style={styles.authButton}
              onPress={() => navigateIfExists('Login')}
            >
              <Text style={dynamicStyles.authButtonText}>Đăng nhập</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authButton, styles.registerButton]}
              onPress={() => navigateIfExists('SignUp')}
            >
              <Text style={dynamicStyles.authButtonText}>Đăng ký</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.emergencyButton,
          isLoadingContacts && styles.emergencyButtonDisabled,
        ]}
        onPress={handleEmergencyPress}
        disabled={isEmergencyInProgressRef.current || isLoadingContacts}
      >
        <Ionicons name="call" size={getScaledSize(24)} color="#fff" />
        <View style={styles.emergencyTextContainer}>
          <Text style={dynamicStyles.emergencyTitle}>Cuộc gọi khẩn cấp</Text>
          <Text style={dynamicStyles.emergencySubtitle}>
            {isEmergencyInProgressRef.current
              ? 'Đang xử lý...'
              : isLoadingContacts
              ? 'Đang tải danh sách...'
              : 'Nhấn để gọi số khẩn cấp'}
          </Text>
        </View>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={emergencyModalVisible}
        onRequestClose={closeEmergencyModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Cuộc gọi khẩn cấp</Text>

            {countdown > 0 && (
              <Text style={dynamicStyles.countdownText}>
                Tự động gọi sau {countdown} giây
              </Text>
            )}

            <Text
              style={[
                dynamicStyles.contactButtonText,
                { textAlign: 'center', marginBottom: 16 },
              ]}
            >
              Chọn số để gọi ngay hoặc đợi tự động gọi theo thứ tự:
            </Text>

            {emergencyContacts
              .filter((contact) => isValidPhoneNumber(contact.phone))
              .map((contact, index) => (
                <TouchableOpacity
                  key={contact.id}
                  style={[
                    styles.contactButton,
                    index === 0 && styles.priorityContactButton,
                  ]}
                  onPress={() => handleManualDial(contact)}
                >
                  <View style={styles.contactButtonContent}>
                    <View style={styles.contactButtonLeft}>
                      <Ionicons
                        name="call"
                        size={getScaledSize(20)}
                        color={index === 0 ? '#ff4d4d' : '#00cc66'}
                      />
                      {index === 0 && (
                        <View style={styles.priorityBadge}>
                          <Text style={dynamicStyles.priorityText}>
                            Ưu tiên
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        dynamicStyles.contactButtonText,
                        index === 0 && { fontWeight: 'bold' },
                      ]}
                    >
                      {contact.name}: {contact.phone}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={closeEmergencyModal}
            >
              <Text style={dynamicStyles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.featureGrid}>
        <View style={styles.featureRow}>
          <TouchableOpacity
            style={styles.featureButton}
            onPress={() => navigateIfExists('Tutorial')}
          >
            <Ionicons
              name="search"
              size={getScaledSize(28)}
              color="#00cc66"
            />
            <Text style={dynamicStyles.featureText}>Tìm hướng dẫn</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.featureButton}
            onPress={() =>
              user ? navigateIfExists('Task') : navigateIfExists('Login')
            }
          >
            <Ionicons
              name="calendar"
              size={getScaledSize(28)}
              color="#00cc66"
            />
            <Text style={dynamicStyles.featureText}>Nhiệm vụ hôm nay</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.featureRow}>
          <TouchableOpacity
            style={styles.featureButton}
            onPress={() => navigateIfExists('ChatBot')}
          >
            <Ionicons
              name="help-circle"
              size={getScaledSize(28)}
              color="#00cc66"
            />
            <Text style={dynamicStyles.featureText}>Hỏi trợ lý</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.featureButton}
            onPress={() =>
              navigateIfExists(user ? 'Setting' : 'Login')
            }
          >
            <Ionicons
              name={user ? 'person' : 'log-in'}
              size={getScaledSize(28)}
              color="#00cc66"
            />
            <Text style={dynamicStyles.featureText}>
              {user ? 'Cài đặt' : 'Đăng nhập'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TabBar selectedTab="Home" onTabPress={handleTabPress} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  pageTitle: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 12,
    alignItems: 'center',
  },
  greetingCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sunIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5fff5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 16,
  },
  progressContainerCompleted: {
    backgroundColor: '#f0fff0',
    borderColor: '#00cc66',
    borderWidth: 1,
  },
  progressCircleContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleBg: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  progressDot: {
    position: 'absolute',
  },
  progressTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  progressText: {
    fontWeight: 'bold',
  },
  progressInfo: {
    flex: 1,
    marginLeft: 16,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskNumberContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#00cc66',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  authButton: {
    flex: 1,
    backgroundColor: '#00cc66',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  registerButton: {
    backgroundColor: '#0099ff',
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4d4d',
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  emergencyButtonDisabled: {
    backgroundColor: '#ff9999',
    opacity: 0.7,
  },
  emergencyTextContainer: {
    marginLeft: 12,
  },
  featureGrid: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 80,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  featureButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    height: 100,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    maxHeight: '70%',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  priorityContactButton: {
    backgroundColor: '#fff5f5',
    borderColor: '#ff4d4d',
    borderWidth: 2,
  },
  contactButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  contactButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  priorityBadge: {
    backgroundColor: '#ff4d4d',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  cancelButton: {
    width: '100%',
    backgroundColor: '#e74c3c',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
});

export default Home;
