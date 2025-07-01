import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { height } = Dimensions.get('window');

function Login() {
  const navigation = useNavigation();
  const [formData, setFormData] = useState({
    phoneNumber: '',
    password: '',
    loading: false,
    error: '',
  });

  const updateFormData = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value, error: '' }));
  }, []);

  const validatePhone = (phone) => /^\+?\d{10,15}$/.test(phone.trim());

  const validateForm = () => {
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
    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    try {
      updateFormData('loading', true);

      const fakeEmail = `${formData.phoneNumber.trim()}@example.com`;

      await auth().signInWithEmailAndPassword(fakeEmail, formData.password.trim());

      Alert.alert('Đăng nhập thành công!', 'Chào mừng bạn trở lại!', [
        { text: 'Bắt đầu', onPress: () => navigation.replace('Home') },
      ]);
    } catch (err) {
      console.error('Login error:', err);
      let errorMessage = 'Đăng nhập thất bại. Vui lòng thử lại.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        errorMessage = 'Số điện thoại không tồn tại.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Mật khẩu không đúng.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Quá nhiều lần thử. Vui lòng thử lại sau.';
      }
      updateFormData('error', errorMessage);
    } finally {
      updateFormData('loading', false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ImageBackground source={require('../../assets/bg-login.jpg')} resizeMode="cover" style={styles.imageBg}>
          <View style={styles.overlay}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Đóng màn hình đăng nhập"
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.formContainer}>
              <Text style={styles.title}>Đăng Nhập</Text>
              <InputField
                label="Số điện thoại"
                icon="call-outline"
                keyboardType="phone-pad"
                value={formData.phoneNumber}
                onChange={(t) => updateFormData('phoneNumber', t)}
                editable={!formData.loading}
              />
              <InputField
                label="Mật khẩu"
                icon="lock-closed-outline"
                secureTextEntry
                value={formData.password}
                onChange={(t) => updateFormData('password', t)}
                editable={!formData.loading}
              />
              <ActionButton
                disabled={formData.loading}
                loading={formData.loading}
                text="ĐĂNG NHẬP"
                onPress={handleLogin}
              />
              {formData.error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={16} color="#e74c3c" />
                  <Text style={styles.errorText}>{formData.error}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={styles.signupLink}
                onPress={() => navigation.navigate('SignUp')}
                disabled={formData.loading}
              >
                <Text style={styles.signupText}>
                  Chưa có tài khoản?<Text style={styles.signupTextBold}> Đăng Ký</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const InputField = ({ label, icon, onChange, ...rest }) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={styles.inputWrapper}>
      <Ionicons name={icon} size={20} color="#666" style={styles.inputIcon} />
      <TextInput
        style={styles.textInput}
        placeholder={label}
        placeholderTextColor="#999"
        onChangeText={onChange}
        {...rest}
      />
    </View>
  </View>
);

const ActionButton = ({ text, loading, disabled, onPress }) => (
  <TouchableOpacity
    style={[styles.loginButton, disabled && styles.loginButtonDisabled]}
    onPress={onPress}
    disabled={disabled}
    accessibilityLabel={text}
  >
    {loading ? (
      <ActivityIndicator size="small" color="#fff" />
    ) : (
      <Text style={styles.loginButtonText}>{text}</Text>
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
    marginBottom: 25 
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
  loginButton: {
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
  loginButtonDisabled: { 
    backgroundColor: '#ccc', 
    shadowOpacity: 0, 
    elevation: 0 
  },
  loginButtonText: { 
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
  signupLink: { 
    alignItems: 'center', 
    padding: 10 
  },
  signupText: { 
    color: '#666', 
    fontSize: 14 
  },
  signupTextBold: { 
    color: '#007BFF', 
    fontWeight: 'bold' 
  },
});

export default Login;