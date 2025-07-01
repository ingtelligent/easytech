import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ensureUserDocument } from '../Data/UserService';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';

const { height } = Dimensions.get('window');

function SignUp() {
  const navigation = useNavigation();
  const [formData, setFormData] = useState({
    fname: '',
    phoneNumber: '',
    password: '',
    email: '',
    profilePic: null,
    photoURL: 'https://i.postimg.cc/zXkPfDnB/logo192.png',
    loading: false,
    error: '',
  });
  const updateFormData = useCallback((field, value) => {
    if (field === 'error') {
      setFormData(prev => ({ ...prev, error: value }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value, error: '' }));
    }
  }, []);
  const validatePhone = (phone) => {
    const cleaned = phone.replace(/\s+/g, '');
    return /^(\+84|84|0)[0-9]{9,10}$/.test(cleaned);
  };
  const validateEmail = (email) => {
    if (!email || email.trim() === '') return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };
  const normalizePhoneNumber = (phone) => {
    const cleaned = phone.replace(/\s+/g, '');
    if (cleaned.startsWith('+84')) return cleaned;
    if (cleaned.startsWith('84')) return '+' + cleaned;
    if (cleaned.startsWith('0')) return '+84' + cleaned.substring(1);
    return '+84' + cleaned;
  };

  const validateStepOne = () => {
    if (!formData.fname.trim()) {
      updateFormData('error', 'Vui lòng nhập tên hiển thị');
      return false;
    }
    if (formData.fname.trim().length < 2) {
      updateFormData('error', 'Tên hiển thị phải có ít nhất 2 ký tự');
      return false;
    }
    if (!formData.phoneNumber.trim()) {
      updateFormData('error', 'Vui lòng nhập số điện thoại');
      return false;
    }
    if (!validatePhone(formData.phoneNumber)) {
      updateFormData('error', 'Số điện thoại không hợp lệ');
      return false;
    }
    if (!formData.password.trim()) {
      updateFormData('error', 'Vui lòng nhập mật khẩu');
      return false;
    }
    if (formData.password.length < 6) {
      updateFormData('error', 'Mật khẩu phải có ít nhất 6 ký tự');
      return false;
    }
    if (formData.email.trim() && !validateEmail(formData.email)) {
      updateFormData('error', 'Email không hợp lệ');
      return false;
    }
    return true;
  };

  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const androidVersion = parseInt(Platform.Version, 10);
        let permission;

        if (androidVersion >= 33) {
          permission = PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES;
        } else {
          permission = PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
        }

        const granted = await PermissionsAndroid.request(permission, {
          title: 'Quyền truy cập ảnh',
          message: 'Ứng dụng cần quyền truy cập ảnh để chọn ảnh đại diện',
          buttonPositive: 'OK',
          buttonNegative: 'Hủy',
        });

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          return true;
        } else {
          Alert.alert(
            'Quyền bị từ chối',
            'Ứng dụng cần quyền truy cập ảnh để chọn ảnh đại diện. Vui lòng cấp quyền trong cài đặt.',
            [
              { text: 'Hủy', style: 'cancel' },
              { text: 'Mở cài đặt', onPress: () => Linking.openSettings() },
            ]
          );
          return false;
        }
      } catch (err) {
        console.warn('Permission request error:', err);
        Alert.alert('Lỗi', 'Không thể yêu cầu quyền truy cập. Vui lòng thử lại.');
        return false;
      }
    }
    return true;
  };

  const handleSelectProfilePic = async () => {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) return;

    const options = {
      mediaType: 'photo',
      maxWidth: 300,
      maxHeight: 300,
      quality: 0.7,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorCode) {
        console.error('ImagePicker Error: ', response.errorMessage);
        updateFormData('error', 'Không thể chọn ảnh. Vui lòng thử lại.');
      } else if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        updateFormData('profilePic', asset);
        updateFormData('photoURL', asset.uri);
      }
    });
  };

  const handleSignUp = async () => {
    if (!validateStepOne()) return;

    try {
      updateFormData('loading', true);

      const normalizedPhone = normalizePhoneNumber(formData.phoneNumber.trim());

      let authEmail;
      if (formData.email.trim()) {
        authEmail = formData.email.trim();
      } else {
        const timestamp = Date.now();
        authEmail = `user_${normalizedPhone.replace('+', '')}_${timestamp}@temp.local`;
      }

      const userCredential = await auth().createUserWithEmailAndPassword(
        authEmail,
        formData.password.trim()
      );
      const user = userCredential.user;

      if (!user || !auth().currentUser) {
        throw new Error('Tạo tài khoản thất bại. Vui lòng thử lại.');
      }

      let photoURL = formData.photoURL;
      if (formData.profilePic) {
        try {
          const ref = storage().ref(`profilePics/${user.uid}`);
          await ref.putFile(formData.profilePic.uri);
          photoURL = await ref.getDownloadURL();
        } catch (uploadErr) {
          console.warn('Avatar upload failed:', uploadErr);
        }
      }

      await user.updateProfile({
        displayName: formData.fname.trim(),
        photoURL,
      });

      const defaultEmergencyContacts = [
        { id: 1, name: 'Liên hệ khẩn cấp 1', phone: null },
        { id: 2, name: 'Liên hệ khẩn cấp 2', phone: null },
        { id: 3, name: 'Liên hệ khẩn cấp 3', phone: null },
      ];

      const userData = {
        displayName: formData.fname.trim(),
        phoneNumber: normalizedPhone,
        email: formData.email.trim() || null,
        authEmail: authEmail,
        photoURL,
        level: 1,
        points: 0,
        completedTasks: [],
        completedTasksCount: 0,
        viewedGuides: 0,
        assistantQuestions: 0,
        preferences: {
          dialect: 'north',
          gender: 'female',
          fontSizeAddition: 0,
        },
        emergencyContacts: defaultEmergencyContacts,
        memories: [],
        createdAt: firestore.FieldValue.serverTimestamp(),
        lastLogin: firestore.FieldValue.serverTimestamp(),
      };

      let documentSaved = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!documentSaved && retryCount < maxRetries) {
        try {
          console.log(`Saving user document (attempt ${retryCount + 1}/${maxRetries})`);
          await firestore().collection('users').doc(user.uid).set(userData);

          const verifyDoc = await firestore().collection('users').doc(user.uid).get();
          if (verifyDoc.exists && verifyDoc.data()?.emergencyContacts) {
            documentSaved = true;
            console.log('User document saved and verified successfully');
          } else {
            throw new Error('Document verification failed');
          }
        } catch (saveError) {
          console.error(`Document save attempt ${retryCount + 1} failed:`, saveError);
          retryCount++;

          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw saveError;
          }
        }
      }

      try {
        await ensureUserDocument();
        console.log('ensureUserDocument completed');
      } catch (ensureError) {
        console.warn('ensureUserDocument failed:', ensureError);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      Alert.alert(
        'Đăng ký thành công!',
        `Xin chào ${formData.fname.trim()}! Tài khoản của bạn đã được tạo thành công.`,
        [
          {
            text: 'Bắt đầu',
            onPress: () => {
              setTimeout(() => {
                navigation.replace('Home');
              }, 200);
            },
          },
        ]
      );
    } catch (err) {
      console.error('Sign up error:', err);

      try {
        const currentUser = auth().currentUser;
        if (currentUser) {
          await currentUser.delete();
        }
      } catch (cleanupErr) {
        console.warn('Cleanup error:', cleanupErr);
      }

      let errorMessage = 'Đăng ký thất bại. Vui lòng thử lại.';

      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Email này đã được sử dụng. Vui lòng sử dụng email khác.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Email không hợp lệ.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.';
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = 'Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại.';
      } else if (err.code === 'firestore/permission-denied') {
        errorMessage = 'Không có quyền truy cập dữ liệu. Vui lòng liên hệ hỗ trợ.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      updateFormData('error', errorMessage);
    } finally {
      updateFormData('loading', false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ImageBackground
          source={require('../../assets/bg-login.jpg')}
          resizeMode="cover"
          style={styles.imageBg}
        >
          <View style={styles.overlay}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Đóng màn hình đăng ký"
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.formContainer}>
              <Text style={styles.title}>Tạo Tài Khoản Mới</Text>

              <View style={styles.avatarContainer}>
                <TouchableOpacity onPress={handleSelectProfilePic} disabled={formData.loading}>
                  <Image source={{ uri: formData.photoURL }} style={styles.avatar} />
                  <View style={styles.avatarEditIcon}>
                    <Ionicons name="camera" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>

              <InputField
                label="Tên hiển thị"
                icon="person-outline"
                value={formData.fname}
                onChange={(t) => updateFormData('fname', t)}
                editable={!formData.loading}
              />

              <InputField
                label="Số điện thoại"
                icon="call-outline"
                keyboardType="phone-pad"
                value={formData.phoneNumber}
                onChange={(t) => updateFormData('phoneNumber', t)}
                editable={!formData.loading}
                placeholder="VD: 0987654321"
              />

              <InputField
                label="Mật khẩu"
                icon="lock-closed-outline"
                secureTextEntry
                value={formData.password}
                onChange={(t) => updateFormData('password', t)}
                editable={!formData.loading}
              />

              <InputField
                label="Email (tuỳ chọn)"
                icon="mail-outline"
                keyboardType="email-address"
                value={formData.email}
                onChange={(t) => updateFormData('email', t)}
                editable={!formData.loading}
                placeholder="example@email.com"
              />

              <ActionButton
                disabled={formData.loading}
                loading={formData.loading}
                text="ĐĂNG KÍ"
                onPress={handleSignUp}
              />

              {formData.error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={16} color="#e74c3c" />
                  <Text style={styles.errorText}>{formData.error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => navigation.navigate('Login')}
                disabled={formData.loading}
              >
                <Text style={styles.loginText}>
                  Đã có tài khoản?<Text style={styles.loginTextBold}> Đăng Nhập</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const InputField = ({ label, icon, onChange, value, placeholder, editable, secureTextEntry, keyboardType }) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={styles.inputWrapper}>
      <Ionicons name={icon} size={20} color="#666" style={styles.inputIcon} />
      <TextInput
        style={styles.textInput}
        placeholder={placeholder || label}
        placeholderTextColor="#999"
        onChangeText={onChange}
        value={value}
        editable={editable}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
      />
    </View>
  </View>
);

const ActionButton = ({ text, loading, disabled, onPress }) => (
  <TouchableOpacity
    style={[styles.registerButton, disabled && styles.registerButtonDisabled]}
    onPress={onPress}
    disabled={disabled}
    accessibilityLabel={text}
  >
    {loading ? (
      <ActivityIndicator size="small" color="#fff" />
    ) : (
      <Text style={styles.registerButtonText}>{text}</Text>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  scrollContainer: { 
    flexGrow: 1 
  },
  imageBg: { 
    minHeight: height, 
    width: '100%' 
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  formContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 30,
    marginTop: 80,
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#333', 
    textAlign: 'center', 
    marginBottom: 5 
  },
  avatarContainer: { 
    alignItems: 'center', 
    marginBottom: 25 
  },
  avatar: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    borderWidth: 3, 
    borderColor: '#007BFF' 
  },
  avatarEditIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007BFF',
    borderRadius: 15,
    padding: 5,
  },
  inputContainer: { 
    marginBottom: 20 
  },
  inputLabel: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#333', 
    marginBottom: 8 
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    paddingHorizontal: 15,
    minHeight: 50,
  },
  inputIcon: { 
    marginRight: 10 
  },
  textInput: { 
    flex: 1, 
    fontSize: 16, 
    color: '#333', 
    paddingVertical: 12 
  },
  registerButton: {
    flexDirection: 'row',
    backgroundColor: '#007BFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#007BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  registerButtonDisabled: { 
    backgroundColor: '#ccc', 
    shadowOpacity: 0, 
    elevation: 0 
  },
  registerButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffe6e6',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
    marginBottom: 15,
  },
  errorText: { 
    color: '#e74c3c', 
    fontSize: 14, 
    marginLeft: 5, 
    flex: 1 
  },
  loginLink: { 
    alignItems: 'center', 
    padding: 10 
  },
  loginText: { 
    color: '#666', 
    fontSize: 14 
  },
  loginTextBold: { 
    color: '#007BFF', 
    fontWeight: 'bold' 
  },
});

export default SignUp;
