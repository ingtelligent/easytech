// src/services/UserService.js
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

/**
 * Tạo tài liệu mặc định cho user nếu chưa tồn tại
 * NÊN gọi ngay sau khi user đăng nhập / đăng ký thành công.
 */
export const ensureUserDocument = async () => {
  const user = auth().currentUser;
  if (!user) return;               // chưa đăng nhập

  const docRef = firestore().collection('users').doc(user.uid);
  const snap   = await docRef.get();

  if (!snap.exists) {
    try {
      await docRef.set({
        // ----- dữ liệu mặc định -----
        name: user.displayName || 'Người dùng',
        email: user.email || '',
        level: 1,
        points: 0,
        completedTasks: 0,
        viewedGuides: 0,
        assistantQuestions: 0,
        preferences: { dialect: 'north', fontSize: 3 },
        emergencyContacts: [],
        memories: [],
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      console.log('[Firestore] User document created');
    } catch (err) {
      console.error('[Firestore] Cannot create user doc:', err);
    }
  }
};
