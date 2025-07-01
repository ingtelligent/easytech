// src/firebase/FirebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyCfJObpQ5iGO-ol5OVx_0Ie6nQbmSfMpR4',
  authDomain: 'easytech-43b98.firebaseapp.com',
  databaseURL: 'https://easytech-43b98-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'easytech-43b98',
  storageBucket: "easytech-43b98.firebasestorage.app",
  messagingSenderId: '352129455446',
  appId: '1:352129455446:android:0d2b7137d6d97e07d7b2f7',
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Khởi tạo các dịch vụ
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const realtimeDb = getDatabase(app);

export { auth, db, storage, realtimeDb };
