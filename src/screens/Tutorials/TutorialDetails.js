import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { UserPreferences } from '../UserPreferences';
import auth from '@react-native-firebase/auth';
import firestore, { FieldValue } from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Configuration data cho từng loại tutorial
const TUTORIAL_CONFIG = {
  facebook: {
    title: 'Cách đăng bài trên Facebook',
    description: 'Hướng dẫn chi tiết từng bước để đăng bài, ảnh và video trên Facebook',
    videoTitle: 'Xem video hướng dẫn đăng bài Facebook',
    videoUrl: 'https://www.youtube.com/watch?v=2I75qpTqsYY',
    steps: [
      {
        id: 1,
        title: 'Bước 1: Mở ứng dụng Facebook',
        description: 'Nhấn vào biểu tượng Facebook trên màn hình chính của điện thoại để mở ứng dụng.',
        image: require('../../assets/tutorials/facebook/step1.png'),
      },
      {
        id: 2,
        title: 'Bước 2: Nhấn vào "Bạn đang nghĩ gì?"',
        description: 'Tìm và nhấn vào ô "Bạn đang nghĩ gì?" ở đầu trang chủ.',
        image: require('../../assets/tutorials/facebook/step2.png'),
      },
      {
        id: 3,
        title: 'Bước 3: Viết nội dung bài đăng',
        description: 'Nhập nội dung bạn muốn chia sẻ vào ô văn bản.',
        image: require('../../assets/tutorials/facebook/step3.png'),
      },
      {
        id: 4,
        title: 'Bước 4: Thêm hình ảnh/video (tuỳ chọn)',
        description: 'Nhấn vào biểu tượng ảnh để thêm hình ảnh hoặc video từ thư viện của bạn.',
        image: require('../../assets/tutorials/facebook/step4.png'),
      },
      {
        id: 5,
        title: 'Bước 5: Chọn đối tượng chia sẻ',
        description: 'Nhấn vào biểu tượng ở góc dưới để chọn ai có thể xem bài đăng (Công khai, Bạn bè, Chỉ mình tôi).',
        image: require('../../assets/tutorials/facebook/step5.png'),
      },
      {
        id: 6,
        title: 'Bước 6: Đăng bài',
        description: 'Nhấn nút "Đăng" để chia sẻ bài viết của bạn.',
        image: require('../../assets/tutorials/facebook/step6.png'),
      },
    ],
    tips: [
      'Hãy kiểm tra chính tả trước khi đăng bài',
      'Sử dụng hashtag phù hợp để tăng tương tác',
      'Đăng bài vào giờ cao điểm để có nhiều người xem',
      'Tương tác với bình luận để tăng độ phủ sóng'
    ]
  },
  
  // zalo: {
  //   title: 'Cách gọi video trên Zalo',
  //   description: 'Hướng dẫn thực hiện cuộc gọi video trên Zalo một cách dễ dàng',
  //   videoTitle: 'Xem video hướng dẫn gọi video Zalo',
  //   steps: [
  //     {
  //       id: 1,
  //       title: 'Bước 1: Mở ứng dụng Zalo',
  //       description: 'Nhấn vào biểu tượng Zalo trên màn hình chính để mở ứng dụng.',
  //       image: require('../../assets/tutorials/zalo/step1.png'),
  //     },
  //     {
  //       id: 2,
  //       title: 'Bước 2: Chọn người cần gọi',
  //       description: 'Tìm và chọn người bạn muốn gọi video trong danh sách tin nhắn.',
  //       image: require('../../assets/tutorials/zalo/step2.png'),
  //     },
  //     {
  //       id: 3,
  //       title: 'Bước 3: Mở cuộc trò chuyện',
  //       description: 'Nhấn vào tên người đó để mở cửa sổ chat.',
  //       image: require('../../assets/tutorials/zalo/step3.png'),
  //     },
  //     {
  //       id: 4,
  //       title: 'Bước 4: Nhấn biểu tượng video call',
  //       description: 'Tìm và nhấn vào biểu tượng camera ở góc trên bên phải màn hình.',
  //       image: require('../../assets/tutorials/zalo/step4.png'),
  //     },
  //     {
  //       id: 5,
  //       title: 'Bước 5: Chờ đối phương nhận máy',
  //       description: 'Đợi đối phương nhấn nhận để bắt đầu cuộc gọi video.',
  //       image: require('../../assets/tutorials/zalo/step5.png'),
  //     },
  //     {
  //       id: 6,
  //       title: 'Bước 6: Thực hiện cuộc gọi',
  //       description: 'Bắt đầu trò chuyện qua video call. Nhấn nút đỏ để kết thúc.',
  //       image: require('../../assets/tutorials/zalo/step6.png'),
  //     },
  //     {
  //       id: 7,
  //       title: 'Bước 7: Điều chỉnh âm thanh/hình ảnh',
  //       description: 'Sử dụng các nút điều khiển để bật/tắt mic, camera trong quá trình gọi.',
  //       image: require('../../assets/tutorials/zalo/step7.png'),
  //     },
  //     {
  //       id: 8,
  //       title: 'Bước 8: Kết thúc cuộc gọi',
  //       description: 'Nhấn nút màu đỏ để kết thúc cuộc gọi video.',
  //       image: require('../../assets/tutorials/zalo/step8.png'),
  //     },
  //   ],
  //   tips: [
  //     'Kiểm tra kết nối internet trước khi gọi',
  //     'Đảm bảo camera và mic được cấp quyền',
  //     'Tìm chỗ có ánh sáng tốt khi gọi video',
  //     'Sử dụng tai nghe để chất lượng âm thanh tốt hơn'
  //   ]
  // },

  // messenger: {
  //   title: 'Cách sử dụng Messenger',
  //   description: 'Hướng dẫn nhắn tin và gửi hình ảnh trên Facebook Messenger',
  //   videoTitle: 'Xem video hướng dẫn sử dụng Messenger',
  //   steps: [
  //     {
  //       id: 1,
  //       title: 'Bước 1: Mở ứng dụng Messenger',
  //       description: 'Nhấn vào biểu tượng Messenger trên màn hình chính.',
  //       image: require('../../assets/tutorials/messenger/step1.png'),
  //     },
  //     {
  //       id: 2,
  //       title: 'Bước 2: Chọn người để nhắn tin',
  //       description: 'Nhấn vào tên người bạn muốn nhắn tin hoặc tìm kiếm.',
  //       image: require('../../assets/tutorials/messenger/step2.png'),
  //     },
  //     {
  //       id: 3,
  //       title: 'Bước 3: Soạn tin nhắn',
  //       description: 'Nhập nội dung tin nhắn vào ô văn bản ở cuối màn hình.',
  //       image: require('../../assets/tutorials/messenger/step3.png'),
  //     },
  //     {
  //       id: 4,
  //       title: 'Bước 4: Gửi hình ảnh',
  //       description: 'Nhấn biểu tượng camera để chụp ảnh hoặc chọn ảnh từ thư viện.',
  //       image: require('../../assets/tutorials/messenger/step4.png'),
  //     },
  //     {
  //       id: 5,
  //       title: 'Bước 5: Gửi tin nhắn',
  //       description: 'Nhấn nút gửi để gửi tin nhắn hoặc hình ảnh.',
  //       image: require('../../assets/tutorials/messenger/step5.png'),
  //     },
  //   ],
  //   tips: [
  //     'Sử dụng emoji để làm tin nhắn sinh động hơn',
  //     'Có thể gửi tin nhắn thoại bằng cách nhấn giữ micro',
  //     'Sử dụng sticker để thể hiện cảm xúc',
  //     'Có thể tạo nhóm chat để trò chuyện với nhiều người'
  //   ]
  // },

  // youtube: {
  //   title: 'Cách sử dụng YouTube',
  //   description: 'Hướng dẫn xem video, subscribe và tạo playlist trên YouTube',
  //   videoTitle: 'Xem video hướng dẫn sử dụng YouTube',
  //   steps: [
  //     {
  //       id: 1,
  //       title: 'Bước 1: Mở ứng dụng YouTube',
  //       description: 'Nhấn vào biểu tượng YouTube trên màn hình chính.',
  //       image: require('../../assets/tutorials/youtube/step1.png'),
  //     },
  //     {
  //       id: 2,
  //       title: 'Bước 2: Tìm kiếm video',
  //       description: 'Nhấn vào ô tìm kiếm ở đầu màn hình và nhập từ khóa.',
  //       image: require('../../assets/tutorials/youtube/step2.png'),
  //     },
  //     {
  //       id: 3,
  //       title: 'Bước 3: Chọn video muốn xem',
  //       description: 'Nhấn vào video bạn muốn xem từ kết quả tìm kiếm.',
  //       image: require('../../assets/tutorials/youtube/step3.png'),
  //     },
  //     {
  //       id: 4,
  //       title: 'Bước 4: Điều khiển phát video',
  //       description: 'Sử dụng các nút play/pause, tua tới/lùi để điều khiển video.',
  //       image: require('../../assets/tutorials/youtube/step4.png'),
  //     },
  //     {
  //       id: 5,
  //       title: 'Bước 5: Like và Subscribe',
  //       description: 'Nhấn nút like và subscribe để ủng hộ kênh yêu thích.',
  //       image: require('../../assets/tutorials/youtube/step5.png'),
  //     },
  //     {
  //       id: 6,
  //       title: 'Bước 6: Tạo Playlist',
  //       description: 'Nhấn "Lưu" để thêm video vào playlist của bạn.',
  //       image: require('../../assets/tutorials/youtube/step6.png'),
  //     },
  //   ],
  //   tips: [
  //     'Đăng ký kênh yêu thích để nhận thông báo video mới',
  //     'Sử dụng chất lượng video phù hợp với kết nối mạng',
  //     'Tạo playlist để tổ chức video theo chủ đề',
  //     'Sử dụng tính năng xem sau để lưu video'
  //   ]
  // },

  // googlemaps: {
  //   title: 'Cách dùng Google Maps',
  //   description: 'Hướng dẫn tìm đường và sử dụng navigation trên Google Maps',
  //   videoTitle: 'Xem video hướng dẫn sử dụng Google Maps',
  //   steps: [
  //     {
  //       id: 1,
  //       title: 'Bước 1: Mở Google Maps',
  //       description: 'Nhấn vào biểu tượng Google Maps trên màn hình chính.',
  //       image: require('../../assets/tutorials/googlemaps/step1.png'),
  //     },
  //     {
  //       id: 2,
  //       title: 'Bước 2: Tìm kiếm địa điểm',
  //       description: 'Nhập tên địa điểm hoặc địa chỉ vào ô tìm kiếm.',
  //       image: require('../../assets/tutorials/googlemaps/step2.png'),
  //     },
  //     {
  //       id: 3,
  //       title: 'Bước 3: Chọn địa điểm',
  //       description: 'Nhấn vào địa điểm từ kết quả tìm kiếm.',
  //       image: require('../../assets/tutorials/googlemaps/step3.png'),
  //     },
  //     {
  //       id: 4,
  //       title: 'Bước 4: Nhấn "Chỉ đường"',
  //       description: 'Nhấn nút "Directions" hoặc "Chỉ đường" màu xanh.',
  //       image: require('../../assets/tutorials/googlemaps/step4.png'),
  //     },
  //     {
  //       id: 5,
  //       title: 'Bước 5: Chọn phương tiện',
  //       description: 'Chọn xe hơi, xe máy, đi bộ hoặc phương tiện công cộng.',
  //       image: require('../../assets/tutorials/googlemaps/step5.png'),
  //     },
  //     {
  //       id: 6,
  //       title: 'Bước 6: Bắt đầu navigation',
  //       description: 'Nhấn "Start" để bắt đầu dẫn đường với giọng nói.',
  //       image: require('../../assets/tutorials/googlemaps/step6.png'),
  //     },
  //   ],
  //   tips: [
  //     'Bật GPS để định vị chính xác',
  //     'Tải bản đồ offline khi đi vùng sóng yếu',
  //     'Sử dụng Street View để xem trước địa điểm',
  //     'Lưu địa điểm thường đi để truy cập nhanh'
  //   ]
  // }
};

const TutorialDetails = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [user, setUser] = useState(null);
  
  // Get tutorial type from route params
  const { guide } = route.params || {};
  const tutorialType = guide?.id || 'facebook'; // Default to facebook
  
  // Get tutorial configuration
  const tutorialConfig = TUTORIAL_CONFIG[tutorialType] || TUTORIAL_CONFIG.facebook;
  
  // Enhanced UserPreferences usage
  const { 
    getScaledSize, 
    getFontSize, 
    getScaledSpacing, 
    getIconSize,
    getComponentSizes 
  } = UserPreferences();

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((userState) => {
      setUser(userState);
    });
    return unsubscribe;
  }, []);

  const incrementViewedGuides = async () => {
    try {
      if (user) {
        if (!FieldValue) {
          throw new Error('FieldValue is not available. Ensure Firestore is properly initialized.');
        }
        const userRef = firestore().collection('users').doc(user.uid);
        await userRef.set(
          {
            viewedGuides: FieldValue.increment(1),
          },
          { merge: true }
        );
      } else {
        const storedPreferences = await AsyncStorage.getItem('userPreferences');
        let preferences = storedPreferences ? JSON.parse(storedPreferences) : {};
        preferences.viewedGuides = (preferences.viewedGuides || 0) + 1;
        await AsyncStorage.setItem('userPreferences', JSON.stringify(preferences));
      }
    } catch (err) {
      console.error('Error incrementing viewedGuides:', err.message, err.stack);
    }
  };

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;

    if (isBottom && !hasCompleted) {
      setHasCompleted(true);
      incrementViewedGuides();
    }
  };

  const openImageModal = (image) => {
    setSelectedImage(image);
    setModalVisible(true);
  };

  const handleImageError = (stepId) => {
    console.log(`Failed to load image for step ${stepId} in ${tutorialType} tutorial`);
  };

  const openVideo = async () => {
    const videoUrl = tutorialConfig.videoUrl;
    
    if (!videoUrl || videoUrl.includes('example_')) {
      Alert.alert(
        'Video chưa có sẵn',
        'Video hướng dẫn cho tutorial này sẽ sớm được cập nhật!',
        [{ text: 'Đã hiểu', style: 'default' }]
      );
      return;
    }

    try {
      const supported = await Linking.canOpenURL(videoUrl);
      if (supported) {
        await Linking.openURL(videoUrl);
      } else {
        Alert.alert(
          'Lỗi',
          'Không thể mở video. Vui lòng kiểm tra lại ứng dụng YouTube hoặc trình duyệt.',
          [{ text: 'Đã hiểu', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Error opening video:', error);
      Alert.alert(
        'Lỗi',
        'Có lỗi xảy ra khi mở video. Vui lòng thử lại sau.',
        [{ text: 'Đã hiểu', style: 'default' }]
      );
    }
  };

  // Create dynamic styles using UserPreferences
  const createDynamicStyles = () => {
    const componentSizes = getComponentSizes();
    
    return StyleSheet.create({
      headerTitle: {
        fontSize: getFontSize('large'),
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
        lineHeight: getFontSize('large') * 1.2,
      },
      headerDescription: {
        fontSize: getFontSize('normal'),
        color: '#666',
        lineHeight: getFontSize('normal') * 1.5,
      },
      sectionTitle: {
        fontSize: getFontSize('medium'),
        fontWeight: 'bold',
        color: '#333',
        marginBottom: getScaledSpacing(15),
      },
      videoTitle: {
        fontSize: getFontSize('normal'),
        color: '#fff',
        textAlign: 'center',
        lineHeight: getFontSize('normal') * 1.3,
      },
      stepTitle: {
        fontSize: getFontSize('normal'),
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
        lineHeight: getFontSize('normal') * 1.3,
      },
      stepDescription: {
        fontSize: getFontSize('normal'),
        color: '#666',
        lineHeight: getFontSize('normal') * 1.4,
      },
      tipText: {
        fontSize: getFontSize('normal'),
        color: '#666',
        lineHeight: getFontSize('normal') * 1.4,
      },
      stepNumberText: {
        fontSize: getFontSize('normal'),
        color: '#fff',
        fontWeight: 'bold',
      },
      playIcon: {
        fontSize: getFontSize('large'),
        color: '#333',
        marginLeft: getScaledSpacing(3),
      },
      headerInfo: {
        backgroundColor: '#fff',
        padding: getScaledSpacing(20),
        marginBottom: getScaledSpacing(10),
      },
      headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: getScaledSpacing(10),
      },
      backButton: {
        padding: getScaledSpacing(8),
        marginRight: getScaledSpacing(12),
      },
      videoSection: {
        backgroundColor: '#fff',
        padding: getScaledSpacing(20),
        marginBottom: getScaledSpacing(10),
      },
      videoPlaceholder: {
        backgroundColor: '#000',
        borderRadius: getScaledSize(12),
        height: getScaledSize(200),
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
      },
      playButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        width: getScaledSize(60),
        height: getScaledSize(60),
        borderRadius: getScaledSize(30),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: getScaledSpacing(10),
      },
      stepsSection: {
        backgroundColor: '#fff',
        padding: getScaledSpacing(20),
        marginBottom: getScaledSpacing(10),
      },
      stepContainer: {
        marginBottom: getScaledSpacing(25),
        paddingBottom: getScaledSpacing(20),
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
      },
      stepHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: getScaledSpacing(15),
      },
      stepNumber: {
        backgroundColor: guide?.color || '#4267B2',
        width: getScaledSize(30),
        height: getScaledSize(30),
        borderRadius: getScaledSize(15),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: getScaledSpacing(12),
      },
      stepImageContainer: {
        marginBottom: getScaledSpacing(15),
      },
      stepImage: {
        width: '100%',
        height: getScaledSize(200),
        borderRadius: getScaledSize(8),
        borderWidth: 2,
        borderColor: '#ddd',
      },
      tipsSection: {
        backgroundColor: '#fff',
        padding: getScaledSpacing(20),
        marginBottom: getScaledSpacing(20),
      },
      tipItem: {
        marginBottom: getScaledSpacing(10),
      },
      modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
      },
      modalImage: {
        width: width * 0.9,
        height: height * 0.7,
      },
      closeModalButton: {
        position: 'absolute',
        top: getScaledSpacing(40),
        right: getScaledSpacing(20),
        padding: getScaledSpacing(10),
      },
    });
  };

  const dynamicStyles = createDynamicStyles();

  return (
    <View style={styles.container}>
      <View style={dynamicStyles.headerInfo}>
        <View style={dynamicStyles.headerTop}>
          <TouchableOpacity
            style={dynamicStyles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Quay lại"
          >
            <Ionicons name="chevron-back-outline" size={getIconSize(28)} color="#333" />
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>{tutorialConfig.title}</Text>
        </View>
        <Text style={dynamicStyles.headerDescription}>
          {tutorialConfig.description}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={dynamicStyles.videoSection}>
          <Text style={dynamicStyles.sectionTitle}>📹 Video hướng dẫn</Text>
          <TouchableOpacity
            style={dynamicStyles.videoPlaceholder}
            onPress={openVideo}
            accessibilityLabel={`Xem video hướng dẫn ${tutorialConfig.title}`}
          >
            <View style={dynamicStyles.playButton}>
              <Text style={dynamicStyles.playIcon}>▶</Text>
            </View>
            <Text style={dynamicStyles.videoTitle}>{tutorialConfig.videoTitle}</Text>
          </TouchableOpacity>
        </View>

        <View style={dynamicStyles.stepsSection}>
          <Text style={dynamicStyles.sectionTitle}>📝 Hướng dẫn từng bước</Text>
          {tutorialConfig.steps.map((step) => (
            <View key={step.id} style={dynamicStyles.stepContainer}>
              <View style={dynamicStyles.stepHeader}>
                <View style={dynamicStyles.stepNumber}>
                  <Text style={dynamicStyles.stepNumberText}>{step.id}</Text>
                </View>
                <Text style={dynamicStyles.stepTitle}>{step.title}</Text>
              </View>
              <TouchableOpacity
                style={dynamicStyles.stepImageContainer}
                onPress={() => openImageModal(step.image)}
                accessibilityLabel={`Phóng to hình ảnh bước ${step.id}`}
              >
                <Image
                  source={step.image}
                  style={dynamicStyles.stepImage}
                  resizeMode="contain"
                  onError={() => handleImageError(step.id)}
                />
              </TouchableOpacity>
              <Text style={dynamicStyles.stepDescription}>{step.description}</Text>
            </View>
          ))}
        </View>

        <View style={dynamicStyles.tipsSection}>
          <Text style={dynamicStyles.sectionTitle}>💡 Mẹo hay</Text>
          {tutorialConfig.tips.map((tip, index) => (
            <View key={index} style={dynamicStyles.tipItem}>
              <Text style={dynamicStyles.tipText}>• {tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={dynamicStyles.modalContainer}>
          <TouchableOpacity
            style={dynamicStyles.closeModalButton}
            onPress={() => setModalVisible(false)}
            accessibilityLabel="Đóng hình ảnh"
          >
            <Ionicons name="close-outline" size={getIconSize(32)} color="#fff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={selectedImage}
              style={dynamicStyles.modalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
  },
});

export default TutorialDetails;