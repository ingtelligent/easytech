import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import TabBar from '../TabBar';
import Header from '../Header';
import { UserPreferences } from '../UserPreferences';

const { width, height } = Dimensions.get('window');

const Tutorial = () => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const webViewRef = useRef(null);
  
  // Use UserPreferences hook
  const { 
    getScaledSize, 
    getFontSize, 
    getScaledSpacing, 
    getIconSize,
    getComponentSizes 
  } = UserPreferences();

  // HTML content for voice recognition
  const voiceSearchHTML = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Voice Search</title>
        <style>
            body {
                margin: 0;
                padding: 20px;
                background: linear-gradient(135deg, #00cc66, #00a352);
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                text-align: center;
            }
            
            .container {
                max-width: 300px;
                width: 100%;
            }
            
            .microphone {
                width: 120px;
                height: 120px;
                border: 4px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 30px;
                background: rgba(255, 255, 255, 0.1);
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .microphone:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: scale(1.05);
            }
            
            .microphone.listening {
                border-color: #fff;
                background: rgba(255, 255, 255, 0.2);
                animation: pulse 1.5s infinite;
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
            
            .mic-icon {
                font-size: 48px;
                color: white;
            }
            
            .status {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 15px;
                min-height: 25px;
            }
            
            .instruction {
                font-size: 14px;
                opacity: 0.9;
                margin-bottom: 30px;
                line-height: 1.5;
            }
            
            .result {
                background: rgba(255, 255, 255, 0.1);
                padding: 15px;
                border-radius: 12px;
                margin-top: 20px;
                font-size: 16px;
                min-height: 50px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .error {
                color: #ffcccb;
                background: rgba(255, 0, 0, 0.1);
                border-color: rgba(255, 0, 0, 0.3);
            }
            
            .buttons {
                display: flex;
                gap: 15px;
                margin-top: 30px;
                justify-content: center;
            }
            
            .btn {
                padding: 12px 24px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                background: rgba(255, 255, 255, 0.1);
                color: white;
                border-radius: 25px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.3s ease;
                text-decoration: none;
            }
            
            .btn:hover {
                background: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.5);
            }
            
            .btn-primary {
                background: white;
                color: #00cc66;
                border-color: white;
            }
            
            .btn-primary:hover {
                background: rgba(255, 255, 255, 0.9);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="microphone" id="micButton">
                <div class="mic-icon">🎤</div>
            </div>
            
            <div class="status" id="status">Nhấn vào microphone để bắt đầu</div>
            <div class="instruction">Nói rõ ràng để tìm kiếm hướng dẫn</div>
            
            <div class="result" id="result" style="display: none;"></div>
            
            <div class="buttons">
                <div class="btn" onclick="startListening()">Thử lại</div>
                <div class="btn btn-primary" onclick="closeModal()">Đóng</div>
            </div>
        </div>

        <script>
            let recognition;
            let isListening = false;
            
            // Check for speech recognition support
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                recognition = new SpeechRecognition();
                
                recognition.continuous = false;
                recognition.interimResults = false;
                recognition.lang = 'vi-VN';
                recognition.maxAlternatives = 1;
                
                recognition.onstart = () => {
                    isListening = true;
                    document.getElementById('micButton').classList.add('listening');
                    document.getElementById('status').textContent = 'Đang nghe... Hãy nói bây giờ';
                    document.getElementById('result').style.display = 'none';
                    
                    // Notify React Native
                    window.ReactNativeWebView?.postMessage(JSON.stringify({
                        type: 'listening_started'
                    }));
                };
                
                recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    document.getElementById('status').textContent = 'Hoàn tất!';
                    document.getElementById('result').textContent = transcript;
                    document.getElementById('result').style.display = 'block';
                    document.getElementById('result').classList.remove('error');
                    
                    // Send result to React Native
                    window.ReactNativeWebView?.postMessage(JSON.stringify({
                        type: 'speech_result',
                        text: transcript
                    }));
                };
                
                recognition.onerror = (event) => {
                    let errorMessage = 'Có lỗi xảy ra';
                    
                    switch(event.error) {
                        case 'no-speech':
                            errorMessage = 'Không phát hiện giọng nói';
                            break;
                        case 'audio-capture':
                            errorMessage = 'Không thể truy cập microphone';
                            break;
                        case 'not-allowed':
                            errorMessage = 'Quyền truy cập microphone bị từ chối';
                            break;
                        case 'network':
                            errorMessage = 'Lỗi kết nối mạng';
                            break;
                        default:
                            errorMessage = 'Lỗi nhận dạng: ' + event.error;
                    }
                    
                    document.getElementById('status').textContent = errorMessage;
                    document.getElementById('result').textContent = errorMessage;
                    document.getElementById('result').style.display = 'block';
                    document.getElementById('result').classList.add('error');
                    
                    // Notify React Native
                    window.ReactNativeWebView?.postMessage(JSON.stringify({
                        type: 'speech_error',
                        error: errorMessage
                    }));
                };
                
                recognition.onend = () => {
                    isListening = false;
                    document.getElementById('micButton').classList.remove('listening');
                    if (document.getElementById('status').textContent === 'Đang nghe... Hãy nói bây giờ') {
                        document.getElementById('status').textContent = 'Hoàn tất! Nhấn "Thử lại" để nói lại';
                    }
                    
                    // Notify React Native
                    window.ReactNativeWebView?.postMessage(JSON.stringify({
                        type: 'listening_ended'
                    }));
                };
            } else {
                document.getElementById('status').textContent = 'Trình duyệt không hỗ trợ nhận dạng giọng nói';
                document.getElementById('micButton').style.opacity = '0.5';
                document.getElementById('micButton').style.cursor = 'not-allowed';
            }
            
            function startListening() {
                if (recognition && !isListening) {
                    try {
                        recognition.start();
                    } catch (error) {
                        console.error('Error starting recognition:', error);
                        document.getElementById('status').textContent = 'Lỗi khởi động nhận dạng giọng nói';
                    }
                }
            }
            
            function closeModal() {
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                    type: 'close_modal'
                }));
            }
            
            // Auto-start listening when page loads
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    if (recognition) {
                        startListening();
                    }
                }, 500);
            });
            
            // Handle mic button click
            document.getElementById('micButton').addEventListener('click', startListening);
        </script>
    </body>
    </html>
  `;

  const navigateIfExists = (route) => {
    if (navigation.getState()?.routeNames.includes(route)) {
      navigation.navigate(route);
    } else {
      Alert.alert('Lỗi', `Màn hình ${route} không tồn tại.`);
    }
  };

  const handleTabPress = (tab) => {
    navigateIfExists(tab);
  };

  // Updated guides with generic screen reference and video URLs
  const guides = [
    {
      id: 'facebook',
      title: 'Cách đăng bài trên Facebook',
      description: 'Học cách đăng bài, ảnh và video trên Facebook một cách dễ dàng',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Facebook_Logo_%282019%29.png/1200px-Facebook_Logo_%282019%29.png',
      color: '#4267B2',
      screen: 'TutorialDetails',
      difficulty: 'Dễ',
      duration: '5 phút',
      steps: 6,
      videoUrl: 'https://www.youtube.com/watch?v=2I75qpTqsYY',
    },
    {
      id: 'zalo',
      title: 'Gọi video trên Zalo',
      description: 'Hướng dẫn cách thực hiện cuộc gọi video trên Zalo hiệu quả',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/2048px-Icon_of_Zalo.svg.png',
      color: '#0084FF',
      screen: 'TutorialDetails',
      difficulty: 'Trung bình',
      duration: '7 phút',
      steps: 8,
      videoUrl: '',
    },
    {
      id: 'messenger',
      title: 'Cách sử dụng Messenger',
      description: 'Tìm hiểu cách nhắn tin và gửi hình ảnh trên Messenger',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Facebook_Messenger_logo_2020.svg/1200px-Facebook_Messenger_logo_2020.svg.png',
      color: '#E91E63',
      screen: 'TutorialDetails',
      difficulty: 'Dễ',
      duration: '4 phút',
      steps: 5,
      videoUrl: '',
    },
    {
      id: 'youtube',
      title: 'Cách sử dụng YouTube',
      description: 'Học cách xem video, subscribe và tạo playlist trên YouTube',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/1200px-YouTube_full-color_icon_%282017%29.svg.png',
      color: '#FF0000',
      screen: 'TutorialDetails',
      difficulty: 'Trung bình',
      duration: '10 phút',
      steps: 12,
      videoUrl: '',
    },
    {
      id: 'googlemaps',
      title: 'Cách dùng Google Maps',
      description: 'Hướng dẫn tìm đường và sử dụng navigation trên Google Maps',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Google_Maps_Logo_2020.svg/1200px-Google_Maps_Logo_2020.svg.png',
      color: '#4285F4',
      screen: 'TutorialDetails',
      difficulty: 'Trung bình',
      duration: '8 phút',
      steps: 10,
      videoUrl: '',
    },
  ];

  // Filter guides safely
  const filteredGuides = guides.filter(
    (guide) =>
      guide.title.toLowerCase().includes(searchText.toLowerCase()) ||
      guide.description.toLowerCase().includes(searchText.toLowerCase())
  );

  // Safe navigation check
  const isScreenAvailable = (screenName) => {
    try {
      const state = navigation.getState();
      return state?.routeNames?.includes(screenName) || false;
    } catch (error) {
      console.warn('Navigation state check failed:', error);
      return false;
    }
  };

  const handleGuidePress = (guide) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      
      // Navigate to TutorialDetails with guide data
      if (guide.screen === 'TutorialDetails' || isScreenAvailable('TutorialDetails')) {
        try {
          navigation.navigate('TutorialDetails', { guide });
        } catch (error) {
          console.warn('Navigation failed:', error);
          showComingSoonAlert(guide.title);
        }
      } else {
        showComingSoonAlert(guide.title);
      }
    }, 300);
  };

  const showComingSoonAlert = (title) => {
    Alert.alert(
      '🚀 Sắp ra mắt',
      `Hướng dẫn "${title}" sẽ sớm được cập nhật!\n\nCảm ơn bạn đã quan tâm.`,
      [{ text: 'Đã hiểu', style: 'default' }]
    );
  };

  const clearSearch = () => {
    setSearchText('');
  };

  // Voice search functions
  const startVoiceSearch = () => {
    setShowVoiceModal(true);
    setIsListening(false);
  };

  const closeVoiceModal = () => {
    setShowVoiceModal(false);
    setIsListening(false);
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'listening_started':
          setIsListening(true);
          break;
          
        case 'listening_ended':
          setIsListening(false);
          break;
          
        case 'speech_result':
          setSearchText(data.text);
          setTimeout(() => {
            closeVoiceModal();
          }, 1000);
          break;
          
        case 'speech_error':
          setIsListening(false);
          // Optionally show error alert
          console.warn('Voice search error:', data.error);
          break;
          
        case 'close_modal':
          closeVoiceModal();
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const renderFallbackIcon = (color) => (
    <View style={[
      styles.fallbackIcon, 
      { 
        backgroundColor: color + '20', 
        borderColor: color,
        width: getScaledSize(60),
        height: getScaledSize(60),
        borderRadius: getScaledSize(16),
      }
    ]}>
      <Ionicons name="document-text-outline" size={getIconSize(24)} color={color} />
    </View>
  );

  // Create dynamic styles using UserPreferences
  const createDynamicStyles = () => {
    const componentSizes = getComponentSizes();
    
    return StyleSheet.create({
      pageTitle: {
        fontSize: getFontSize('xxlarge'),
        fontWeight: '700',
        color: '#333',
        lineHeight: getFontSize('xxlarge') * 1.1,
        width: '30%',
      },
      searchInput: {
        flex: 1,
        height: '100%',
        fontSize: getFontSize('normal'),
        color: '#333',
      },
      resultText: {
        fontSize: getFontSize('small'),
        color: '#666',
        fontWeight: '500',
      },
      loadingText: {
        marginTop: getScaledSpacing(12),
        fontSize: getFontSize('normal'),
        color: '#666',
        fontWeight: '500',
      },
      guideTitle: {
        fontSize: getFontSize('medium'),
        fontWeight: '600',
        color: '#333',
        marginBottom: getScaledSpacing(6),
        lineHeight: getFontSize('medium') * 1.3,
      },
      guideDescription: {
        fontSize: getFontSize('small'),
        color: '#666',
        lineHeight: getFontSize('small') * 1.4,
        marginBottom: getScaledSpacing(12),
      },
      metadataText: {
        fontSize: getFontSize('small') - 2,
        color: '#666',
        marginLeft: getScaledSpacing(6),
        fontWeight: '500',
      },
      difficultyText: {
        fontSize: getFontSize('small') - 4,
        color: '#fff',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      },
      noResultsTitle: {
        fontSize: getFontSize('large'),
        fontWeight: '600',
        color: '#333',
        marginTop: getScaledSpacing(20),
        marginBottom: getScaledSpacing(12),
        textAlign: 'center',
      },
      noResultsText: {
        fontSize: getFontSize('normal'),
        color: '#666',
        textAlign: 'center',
        lineHeight: getFontSize('normal') * 1.5,
        marginBottom: getScaledSpacing(32),
      },
      clearSearchButtonText: {
        color: '#fff',
        fontSize: getFontSize('normal'),
        fontWeight: '600',
      },
      searchContainer: {
        flex: 1,
        height: componentSizes.inputHeight,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: componentSizes.inputHeight / 2,
        paddingHorizontal: getScaledSpacing(16),
        marginLeft: getScaledSpacing(16),
        borderWidth: 1.5,
        borderColor: '#e9ecef',
      },
      guideIcon: {
        width: getScaledSize(60),
        height: getScaledSize(60),
        borderRadius: getScaledSize(16),
        padding: getScaledSpacing(8),
      },
      difficultyBadge: {
        paddingHorizontal: getScaledSpacing(10),
        paddingVertical: getScaledSpacing(4),
        borderRadius: getScaledSpacing(12),
        marginLeft: getScaledSpacing(4),
      },
    });
  };

  const dynamicStyles = createDynamicStyles();

  const renderGuideItem = ({ item, index }) => (
    <TouchableOpacity
      style={[
        styles.guideItem,
        {
          borderLeftColor: item.color,
          marginBottom: index === filteredGuides.length - 1 ? getScaledSpacing(20) : getScaledSpacing(12),
          padding: getScaledSpacing(20),
          borderRadius: getScaledSize(16),
        },
      ]}
      activeOpacity={0.8}
      onPress={() => handleGuidePress(item)}
      accessibilityLabel={`${item.title}, ${item.description}, ${item.difficulty}, ${item.duration}`}
      accessibilityRole="button"
    >
      <View style={styles.guideHeader}>
        <View style={[styles.iconContainer, { marginRight: getScaledSpacing(16) }]}>
          <Image
            source={{ uri: item.icon }}
            style={[dynamicStyles.guideIcon, { backgroundColor: item.color + '15' }]}
            resizeMode="contain"
            onError={() => console.log(`Failed to load image for ${item.title}`)}
          />
        </View>
        <View style={styles.guideContent}>
          <Text style={dynamicStyles.guideTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={dynamicStyles.guideDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={styles.guideMetadata}>
            <View style={styles.metadataItem}>
              <Ionicons name="time-outline" size={getIconSize(14)} color="#666" />
              <Text style={dynamicStyles.metadataText}>{item.duration}</Text>
            </View>
            <View style={[styles.metadataItem, { marginRight: getScaledSpacing(16) }]}>
              <Ionicons name="list-outline" size={getIconSize(14)} color="#666" />
              <Text style={dynamicStyles.metadataText}>{item.steps} bước</Text>
            </View>
            <View style={[dynamicStyles.difficultyBadge, { backgroundColor: getDifficultyColor(item.difficulty) }]}>
              <Text style={dynamicStyles.difficultyText}>{item.difficulty}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={[styles.arrowContainer, { marginLeft: getScaledSpacing(12) }]}>
        <Ionicons name="chevron-forward-outline" size={getIconSize(20)} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#00cc66" barStyle="light-content" />
      <Header showBackButton={false} />

      {/* Title and Search */}
      <View style={[
        styles.titleSearchContainer,
        { 
          marginHorizontal: getScaledSpacing(16),
          marginTop: getScaledSpacing(12),
          borderRadius: getScaledSize(16),
        }
      ]}>
        <View style={[
          styles.titleContainer,
          {
            paddingHorizontal: getScaledSpacing(20),
            paddingTop: getScaledSpacing(20),
            paddingBottom: getScaledSpacing(16),
          }
        ]}>
          <Text style={dynamicStyles.pageTitle}>
            Hướng{'\n'}dẫn
          </Text>
          <View style={dynamicStyles.searchContainer}>
            <Ionicons name="search-outline" size={getIconSize(20)} color="#888" style={styles.searchIcon} />
            <TextInput
              style={dynamicStyles.searchInput}
              placeholder="Tìm hướng dẫn..."
              placeholderTextColor="#888"
              value={searchText}
              onChangeText={setSearchText}
              accessibilityLabel="Tìm kiếm hướng dẫn"
              returnKeyType="search"
              maxLength={50}
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                style={[styles.clearButton, { padding: getScaledSpacing(6) }]}
                onPress={clearSearch}
                accessibilityLabel="Xóa nội dung tìm kiếm"
                accessibilityRole="button"
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={getIconSize(20)} color="#999" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.voiceButton, { 
                marginLeft: getScaledSpacing(8),
                padding: getScaledSpacing(6),
                borderRadius: getScaledSize(20),
              }]}
              onPress={startVoiceSearch}
              accessibilityLabel="Tìm kiếm bằng giọng nói"
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Ionicons name="mic-outline" size={getIconSize(20)} color="#00cc66" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={[
          styles.resultContainer,
          {
            paddingHorizontal: getScaledSpacing(20),
            paddingBottom: getScaledSpacing(16),
          }
        ]}>
          <Text style={dynamicStyles.resultText}>
            {searchText
              ? `Tìm thấy ${filteredGuides.length} kết quả cho "${searchText}"`
              : `${guides.length} hướng dẫn có sẵn`}
          </Text>
        </View>
      </View>

      {/* Voice Search Modal */}
      <Modal
        visible={showVoiceModal}
        animationType="slide"
        transparent={false}
        onRequestClose={closeVoiceModal}
      >
        <SafeAreaView style={styles.voiceModalContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: voiceSearchHTML }}
            style={styles.webView}
            onMessage={handleWebViewMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={['*']}
            mixedContentMode="compatibility"
          />
        </SafeAreaView>
      </Modal>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={[
            styles.loadingContainer,
            {
              padding: getScaledSpacing(24),
              borderRadius: getScaledSize(16),
            }
          ]}>
            <ActivityIndicator size="large" color="#00cc66" />
            <Text style={dynamicStyles.loadingText}>Đang tải...</Text>
          </View>
        </View>
      )}

      {/* Guide List */}
      <FlatList
        data={filteredGuides}
        keyExtractor={(item) => item.id}
        renderItem={renderGuideItem}
        contentContainerStyle={[styles.guideListContent, { paddingHorizontal: getScaledSpacing(16), paddingBottom: getScaledSpacing(100) }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={10}
        ListEmptyComponent={
          <View style={[styles.noResultsContainer, { paddingVertical: getScaledSpacing(80), paddingHorizontal: getScaledSpacing(40) }]}>
            <Ionicons name="search-outline" size={getIconSize(64)} color="#ddd" />
            <Text style={dynamicStyles.noResultsTitle}>Không tìm thấy kết quả</Text>
            <Text style={dynamicStyles.noResultsText}>
              {searchText
                ? `Không có hướng dẫn nào khớp với "${searchText}"\nThử tìm kiếm với từ khóa khác`
                : 'Danh sách hướng dẫn trống'}
            </Text>
            {searchText.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.clearSearchButton,
                  {
                    paddingHorizontal: getScaledSpacing(28),
                    paddingVertical: getScaledSpacing(14),
                    borderRadius: getScaledSize(12),
                  }
                ]}
                onPress={clearSearch}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={dynamicStyles.clearSearchButtonText}>Xóa tìm kiếm</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListHeaderComponent={<View style={[styles.listHeader, { height: getScaledSpacing(12) }]} />}
        ListFooterComponent={<View style={[styles.listFooter, { height: getScaledSpacing(20) }]} />}
      />
      <TabBar selectedTab="Tutorial" onTabPress={handleTabPress} />
    </SafeAreaView>
  );
};

// Helper function with error handling
const getDifficultyColor = (difficulty) => {
  const colorMap = {
    'Dễ': '#4CAF50',
    'Trung bình': '#FF9800',
    'Khó': '#F44336',
  };
  return colorMap[difficulty] || '#9E9E9E';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#00cc66',
    paddingHorizontal: 20,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  logoText: {
    color: '#00cc66',
    fontSize: 20,
    fontWeight: 'bold',
  },
  logoInfo: {
    marginLeft: 12,
  },
  logoTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  logoSubtitle: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
  },
  userIconContainer: {
    padding: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  titleSearchContainer: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 12,
  },
  clearButton: {
    marginRight: 8,
  },
  voiceButton: {
    backgroundColor: 'rgba(0, 204, 102, 0.1)',
  },
  resultContainer: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  voiceModalContainer: {
    flex: 1,
    backgroundColor: '#00cc66',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: '#fff',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  guideListContent: {
    // Handled dynamically
  },
  listHeader: {
    // Handled dynamically
  },
  listFooter: {
    // Handled dynamically
  },
  guideItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderLeftWidth: 4,
    alignItems: 'center',
  },
  guideHeader: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  iconContainer: {
    // Handled dynamically
  },
  fallbackIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  guideContent: {
    flex: 1,
    justifyContent: 'center',
  },
  guideMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  arrowContainer: {
    padding: 4,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearSearchButton: {
    backgroundColor: '#00cc66',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});

export default Tutorial;