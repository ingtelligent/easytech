import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Animated,
  Dimensions,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import TabBar from '../TabBar';
import { UserPreferences } from '../UserPreferences';
import Header from '../Header';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// Theme colors for consistency
const COLORS = {
  primary: '#00cc66',
  primaryLight: '#33d985',
  primaryUltraLight: '#e6f9f0',
  secondary: '#4285F4',
  accent: '#FF6B6B',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  white: '#FFFFFF',
  background: '#f8f9fa',
  surface: '#FFFFFF',
  text: '#1a1a1a',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#E0E0E0',
  shadow: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.05)',
};

const Task = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [refreshing, setRefreshing] = useState(false);
  const [completedTasks, setCompletedTasks] = useState(new Set());
  const [animatedValues, setAnimatedValues] = useState([]);
  const [user, setUser] = useState(null);
  const [userStats, setUserStats] = useState({
    totalPoints: 0,
    completedTasksCount: 0,
    level: 1,
  });
  const [currentDate, setCurrentDate] = useState(new Date().toDateString());
  const { currentFontSize, getScaledSize } = UserPreferences();

  const navigateIfExists = (route) => {
    try {
      navigation.navigate(route);
    } catch (error) {
      console.warn(`Navigation error for route ${route}:`, error);
      Alert.alert('Lỗi', `Không thể điều hướng đến ${route}. Vui lòng thử lại.`);
    }
  };

  const handleTabPress = (tab) => {
    navigateIfExists(tab);
  };

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((userState) => {
      setUser(userState);
      if (userState) {
        loadUserTaskData(userState.uid);
      } else {
        loadGuestTaskData();
      }
    });
    return unsubscribe;
  }, []);

  const checkDailyReset = async () => {
    const today = new Date().toDateString();
    let lastResetDate = user
      ? (await firestore().collection('users').doc(user.uid).get()).data()?.lastTaskReset
      : await AsyncStorage.getItem('lastTaskReset');
    if (lastResetDate !== today) {
      setCompletedTasks(new Set());
      const resetStats = {
        ...userStats,
        completedTasksCount: 0, // Reset completedTasksCount
      };
      setUserStats(resetStats);
      if (user) {
        await firestore().collection('users').doc(user.uid).update({
          completedTasks: [],
          completedTasksCount: 0, // Reset completedTasksCount
          lastTaskReset: today,
        });
      } else {
        await AsyncStorage.setItem('completedTasks', JSON.stringify([]));
        await AsyncStorage.setItem('userStats', JSON.stringify(resetStats));
        await AsyncStorage.setItem('lastTaskReset', today);
      }
      setCurrentDate(today);
    }
  };

  const loadUserTaskData = async (userId) => {
    try {
      await checkDailyReset();
      const docSnap = await firestore().collection('users').doc(userId).get();

      if (docSnap.exists) {
        const data = docSnap.data();
        if (data.completedTasks && Array.isArray(data.completedTasks)) {
          setCompletedTasks(new Set(data.completedTasks));
        }
        setUserStats({
          totalPoints: data.points || 0,
          completedTasksCount: data.completedTasksCount || 0,
          level: data.level || 1,
        });
      }
    } catch (error) {
      console.error('Error loading user task data:', error);
    }
  };

  const loadGuestTaskData = async () => {
    try {
      await checkDailyReset();
      const savedCompletedTasks = await AsyncStorage.getItem('completedTasks');
      const savedUserStats = await AsyncStorage.getItem('userStats');

      if (savedCompletedTasks) {
        setCompletedTasks(new Set(JSON.parse(savedCompletedTasks)));
      }

      if (savedUserStats) {
        setUserStats(JSON.parse(savedUserStats));
      }
    } catch (error) {
      console.error('Error loading guest task data:', error);
    }
  };

  const saveCompletedTask = async (taskId, earnedPoints) => {
    try {
      const newCompletedTasks = new Set([...completedTasks, taskId]);
      const newStats = {
        ...userStats,
        totalPoints: userStats.totalPoints + earnedPoints,
        completedTasksCount: userStats.completedTasksCount + 1,
        level: Math.floor((userStats.totalPoints + earnedPoints) / 100) + 1,
      };

      setCompletedTasks(newCompletedTasks);
      setUserStats(newStats);

      if (user) {
        await firestore().collection('users').doc(user.uid).set({
          completedTasks: Array.from(newCompletedTasks),
          points: newStats.totalPoints,
          completedTasksCount: newStats.completedTasksCount,
          level: newStats.level,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } else {
        await AsyncStorage.setItem('completedTasks', JSON.stringify(Array.from(newCompletedTasks)));
        await AsyncStorage.setItem('userStats', JSON.stringify(newStats));
      }
    } catch (error) {
      console.error('Error saving completed task:', error);
      Alert.alert('Lỗi', 'Không thể lưu tiến trình hoàn thành nhiệm vụ');
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);

    if (user) {
      loadUserTaskData(user.uid);
    } else {
      loadGuestTaskData();
    }

    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, [user]);

  const allTasks = [
    {
      id: '1',
      title: 'Tìm kiếm thông tin trên Google',
      description: 'Thực hành tìm kiếm một thông tin bạn quan tâm trên Google và chụp ảnh kết quả.',
      points: 10,
      icon: 'search-outline',
      category: 'Tìm kiếm',
      difficulty: 'Dễ',
      estimatedTime: '5 phút',
      color: COLORS.secondary,
      type: 'tutorial',
    },
    {
      id: '2',
      title: 'Gọi video cho người thân',
      description: 'Thực hiện một cuộc gọi video với người thân hoặc bạn bè và chụp ảnh màn hình.',
      points: 20,
      icon: 'videocam-outline',
      category: 'Giao tiếp',
      difficulty: 'Trung bình',
      estimatedTime: '15 phút',
      color: COLORS.accent,
      type: 'tutorial',
    },
    {
      id: '3',
      title: 'Đăng bài lên Facebook',
      description: 'Chia sẻ một khoảnh khắc trong ngày của bạn trên Facebook và chụp ảnh màn hình.',
      points: 15,
      icon: 'share-outline',
      category: 'Mạng xã hội',
      difficulty: 'Dễ',
      estimatedTime: '10 phút',
      color: '#4267B2',
      type: 'tutorial',
    },
    {
      id: '4',
      title: 'Gửi tin nhắn Zalo',
      description: 'Gửi tin nhắn chào hỏi cho một người bạn qua Zalo và chụp ảnh màn hình.',
      points: 10,
      icon: 'chatbubble-outline',
      category: 'Giao tiếp',
      difficulty: 'Dễ',
      estimatedTime: '5 phút',
      color: '#0068FF',
      type: 'tutorial',
    },
  ];

  const tasks = allTasks.slice(0, 3);

  useEffect(() => {
    const initialAnimatedValues = tasks.map(() => new Animated.Value(0));
    setAnimatedValues(initialAnimatedValues);

    const animations = initialAnimatedValues.map((animatedValue, index) =>
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      })
    );
    Animated.stagger(50, animations).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.completedTaskId) {
        const { completedTaskId, earnedPoints } = route.params;

        if (!completedTasks.has(completedTaskId)) {
          saveCompletedTask(completedTaskId, earnedPoints);

          setTimeout(() => {
            Alert.alert(
              'Nhiệm vụ hoàn thành! 🎉',
              `Bạn đã kiếm được ${earnedPoints} điểm!\n\nTổng điểm: ${userStats.totalPoints + earnedPoints}`,
              [{ text: 'Tuyệt vời!', style: 'default' }]
            );
          }, 500);
        }

        navigation.setParams({ completedTaskId: null, earnedPoints: null });
      }
    }, [route.params, completedTasks, userStats, navigation])
  );

  const handleTaskPress = (task) => {
    const isCompleted = completedTasks.has(task.id);

    if (isCompleted) {
      Alert.alert(
        'Nhiệm vụ đã hoàn thành',
        'Bạn đã hoàn thành nhiệm vụ này rồi! 🎉',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    if (!user && (task.category === 'Mạng xã hội' || task.points > 15)) {
      Alert.alert(
        'Cần đăng nhập',
        'Bạn cần đăng nhập để thực hiện nhiệm vụ này.',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Đăng nhập', onPress: () => navigation.navigate('Login') },
        ]
      );
      return;
    }

    navigation.navigate('TaskTutorial', { task });
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Dễ':
        return COLORS.success;
      case 'Trung bình':
        return COLORS.warning;
      case 'Khó':
        return COLORS.error;
      default:
        return COLORS.textMuted;
    }
  };

  const dynamicStyles = StyleSheet.create({
    pageTitle: {
      fontSize: getScaledSize(28),
      fontWeight: '800',
      color: COLORS.text,
      letterSpacing: -0.5,
    },
    pageSubtitle: {
      fontSize: getScaledSize(15),
      color: COLORS.textSecondary,
      marginTop: 6,
      lineHeight: getScaledSize(22),
    },
    progressLabel: {
      fontSize: getScaledSize(18),
      fontWeight: '700',
      color: COLORS.text,
      marginBottom: 16,
    },
    progressText: {
      fontSize: getScaledSize(14),
      color: COLORS.textSecondary,
      marginTop: 12,
      textAlign: 'center',
    },
    statNumber: {
      fontSize: getScaledSize(26),
      fontWeight: '800',
      color: COLORS.primary,
      letterSpacing: -0.5,
    },
    statLabel: {
      fontSize: getScaledSize(13),
      color: COLORS.textSecondary,
      marginTop: 6,
      fontWeight: '500',
    },
    categoryText: {
      fontSize: getScaledSize(11),
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    difficultyText: {
      fontSize: getScaledSize(10),
      color: COLORS.white,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    taskTitle: {
      fontSize: getScaledSize(20),
      fontWeight: '700',
      color: COLORS.text,
      marginBottom: 10,
      lineHeight: getScaledSize(28),
      letterSpacing: -0.3,
    },
    taskDescription: {
      fontSize: getScaledSize(15),
      color: COLORS.textSecondary,
      lineHeight: getScaledSize(23),
      marginBottom: 16,
    },
    metaText: {
      fontSize: getScaledSize(13),
      color: COLORS.textSecondary,
      fontWeight: '500',
    },
    pointsText: {
      fontSize: getScaledSize(16),
      fontWeight: '700',
      color: COLORS.text,
    },
    completedLabel: {
      fontSize: getScaledSize(11),
      color: COLORS.success,
      fontWeight: '600',
      marginTop: 6,
      letterSpacing: 0.3,
    },
    congratsTitle: {
      fontSize: getScaledSize(26),
      fontWeight: '800',
      color: COLORS.text,
      marginTop: 20,
      marginBottom: 12,
      letterSpacing: -0.5,
    },
    congratsText: {
      fontSize: getScaledSize(16),
      color: COLORS.textSecondary,
      textAlign: 'center',
      lineHeight: getScaledSize(24),
    },
  });

  const renderTask = (task, index) => {
    const isCompleted = completedTasks.has(task.id);
    const animatedValue = animatedValues[index];

    if (!animatedValue) {
      return (
        <View key={task.id} style={styles.taskItem}>
          <TouchableOpacity
            style={[styles.taskContent, isCompleted && styles.completedTask]}
            activeOpacity={0.7}
            onPress={() => handleTaskPress(task)}
            accessibilityLabel={`${task.title}, ${task.points} điểm, ${task.difficulty}`}
            accessibilityHint="Nhấn để bắt đầu nhiệm vụ"
          >
            {renderTaskContent(task, isCompleted)}
          </TouchableOpacity>
        </View>
      );
    }

    const animatedStyle = {
      opacity: animatedValue,
      transform: [
        {
          translateY: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [30, 0],
          }),
        },
        {
          scale: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0.95, 1],
          }),
        },
      ],
    };

    return (
      <Animated.View key={task.id} style={[styles.taskItem, animatedStyle]}>
        <TouchableOpacity
          style={[styles.taskContent, isCompleted && styles.completedTask]}
          activeOpacity={0.7}
          onPress={() => handleTaskPress(task)}
          accessibilityLabel={`${task.title}, ${task.points} điểm, ${task.difficulty}`}
          accessibilityHint="Nhấn để bắt đầu nhiệm vụ"
        >
          {renderTaskContent(task, isCompleted)}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderTaskContent = (task, isCompleted) => (
    <>
      <View style={styles.taskHeader}>
        <View style={[styles.taskIconContainer, { backgroundColor: task.color + '15' }]}>
          <Ionicons name={task.icon} size={getScaledSize(26)} color={task.color} />
        </View>
        <View style={styles.taskBadges}>
          <View style={[styles.categoryBadge, { backgroundColor: task.color + '12' }]}>
            <Text style={[dynamicStyles.categoryText, { color: task.color }]}>
              {task.category}
            </Text>
          </View>
          <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(task.difficulty) }]}>
            <Text style={dynamicStyles.difficultyText}>
              {task.difficulty}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.taskInfo}>
        <Text style={[dynamicStyles.taskTitle, isCompleted && styles.completedText]}>
          {task.title}
          {isCompleted && ' ✓'}
        </Text>
        <Text style={[dynamicStyles.taskDescription, isCompleted && styles.completedDescription]}>
          {task.description}
        </Text>

        <View style={styles.taskMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={getScaledSize(16)} color={COLORS.textMuted} />
            <Text style={dynamicStyles.metaText}>{task.estimatedTime}</Text>
          </View>
        </View>
      </View>

      <View style={styles.pointsSection}>
        <View style={[styles.pointsContainer, isCompleted && styles.completedPoints]}>
          <Ionicons
            name={isCompleted ? 'checkmark-circle' : 'star'}
            size={getScaledSize(18)}
            color={isCompleted ? COLORS.success : '#FFD700'}
          />
          <Text style={[dynamicStyles.pointsText, isCompleted && styles.completedPointsText]}>
            {task.points} điểm
          </Text>
        </View>
        {isCompleted && <Text style={dynamicStyles.completedLabel}>Hoàn thành</Text>}
      </View>
    </>
  );

  const completionRate = tasks.length > 0 ? (completedTasks.size / 3) * 100 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <Header showBackButton={false} />
      
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.titleContainer}>
          <Text style={dynamicStyles.pageTitle}>Nhiệm vụ hàng ngày</Text>
          <Text style={dynamicStyles.pageSubtitle}>
            Hoàn thành để nhận điểm thưởng {!user && '(Một số nhiệm vụ cần đăng nhập)'}
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={dynamicStyles.statNumber}>{completedTasks.size}/3</Text>
            <Text style={dynamicStyles.statLabel}>Nhiệm vụ</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={dynamicStyles.statNumber}>{userStats.totalPoints}</Text>
            <Text style={dynamicStyles.statLabel}>Điểm tích lũy</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={dynamicStyles.statNumber}>Cấp {userStats.level}</Text>
            <Text style={dynamicStyles.statLabel}>Cấp độ</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <Text style={dynamicStyles.progressLabel}>Tiến độ hôm nay</Text>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <Animated.View 
                style={[
                  styles.progressFill, 
                  { width: `${completionRate}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressPercentage}>{Math.round(completionRate)}%</Text>
          </View>
          <Text style={dynamicStyles.progressText}>
            {completedTasks.size} / 3 nhiệm vụ đã hoàn thành
          </Text>
        </View>

        <View style={styles.taskList}>
          {tasks.map((task, index) => renderTask(task, index))}

          {completedTasks.size === 3 && (
            <View style={styles.congratsContainer}>
              <View style={styles.congratsIcon}>
                <Ionicons name="trophy" size={getScaledSize(56)} color="#FFD700" />
              </View>
              <Text style={dynamicStyles.congratsTitle}>Xuất sắc! 🎉</Text>
              <Text style={dynamicStyles.congratsText}>
                Bạn đã hoàn thành tất cả nhiệm vụ hôm nay!{'\n'}
                Tổng điểm: {userStats.totalPoints} | Cấp độ: {userStats.level}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <TabBar selectedTab="Task" onTabPress={handleTabPress} />
    </SafeAreaView>
  );
};

// Enhanced styles with better organization and consistency
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
  progressContainer: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 28,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  progressBar: {
    flex: 1,
    height: 10,
    backgroundColor: COLORS.overlay,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    minWidth: 45,
    textAlign: 'right',
  },
  taskList: {
    paddingHorizontal: 20,
  },
  taskItem: {
    marginBottom: 20,
  },
  taskContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.02)',
  },
  completedTask: {
    backgroundColor: '#f8f9fa',
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  taskIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  taskBadges: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  categoryBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  difficultyBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  taskInfo: {
    flex: 1,
    marginBottom: 20,
  },
  completedText: {
    color: COLORS.success,
  },
  completedDescription: {
    color: COLORS.textMuted,
  },
  taskMeta: {
    flexDirection: 'row',
    gap: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsSection: {
    alignItems: 'flex-end',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9C4',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
    gap: 8,
  },
  completedPoints: {
    backgroundColor: '#E8F5E8',
  },
  completedPointsText: {
    color: COLORS.success,
  },
  congratsContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    marginTop: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.1)',
  },
  congratsIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF9C4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
});

export default Task;