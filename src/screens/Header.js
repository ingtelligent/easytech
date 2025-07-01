import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { UserPreferences } from "./UserPreferences";
import app from "../assets/app-header.png";

const DEFAULT_BG = "#00cc66";

export default function Header({
  title = "EasyTech",
  subtitle,
  showBackButton = false,
  backgroundColor = DEFAULT_BG,
  rightComponent,
  onBackPress,
}) {
  const navigation = useNavigation();
  const { getScaledSize } = UserPreferences();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({
    name: "Người dùng",
    level: 1,
    points: 0,
    completedTasks: 0,
    viewedGuides: 0,
    assistantQuestions: 0,
  });
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [levelProgress, setLevelProgress] = useState(0);

  // Refs for preventing race conditions
  const isMountedRef = useRef(true);
  const loadingStateRef = useRef(false);

  // Animation values
  const pointsAnimValue = useRef(new Animated.Value(0)).current;
  const levelAnimValue = useRef(new Animated.Value(0)).current;

  // Level system configuration
  const LEVEL_CONFIG = {
    pointsPerLevel: [0, 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000],
    levelTitles: [
      "Người mới tập dùng",
      "Người biết sơ sơ",
      "Người dùng cơ bản",
      "Người sử dụng tự tin",
      "Người thành thạo",
      "Người điêu luyện",
      "Người lão luyện",
      "Người nhiều kinh nghiệm",
      "Người đạt trình cao cấp",
      "Cao thủ công nghệ"
    ]
  };

  // Calculate level and progress based on points
  const calculateLevelInfo = useCallback((points) => {
    // Validate input
    if (typeof points !== 'number' || points < 0) {
      points = 0;
    }
    
    let currentLevel = 1;
    
    // ✅ LOGIC ĐÚNG: Tìm từ level cao nhất xuống
    for (let i = LEVEL_CONFIG.pointsPerLevel.length - 1; i >= 0; i--) {
      if (points >= LEVEL_CONFIG.pointsPerLevel[i]) {
        currentLevel = i + 1;
        break;
      }
    }

    currentLevel = Math.max(1, Math.min(LEVEL_CONFIG.pointsPerLevel.length, currentLevel));
  
    const currentLevelPoints = LEVEL_CONFIG.pointsPerLevel[currentLevel - 1] || 0;
    const nextLevelPoints = LEVEL_CONFIG.pointsPerLevel[currentLevel] || currentLevelPoints;

    const progressInCurrentLevel = Math.max(0, points - currentLevelPoints);
    const pointsNeededForLevel = Math.max(1, nextLevelPoints - currentLevelPoints);
    const progress = Math.min(1, progressInCurrentLevel / pointsNeededForLevel);
    
    const pointsForNext = Math.max(0, nextLevelPoints - points);
    const isMaxLevel = currentLevel >= LEVEL_CONFIG.pointsPerLevel.length;
    const title = LEVEL_CONFIG.levelTitles[currentLevel - 1] || "Tối cao";
  
    return {
      level: currentLevel,
      progress: isMaxLevel ? 1 : progress,
      pointsForNext: isMaxLevel ? 0 : pointsForNext,
      title,
      isMaxLevel
    };
  }, []);

  // Enhanced user data loading with level calculation
  const fetchUserProfile = useCallback(async (uid, authUser) => {
    if (!uid || loadingStateRef.current) return;
    
    loadingStateRef.current = true;
    setIsLoading(true);
  
    try {
      const snap = await firestore().collection("users").doc(uid).get();
      
      if (!isMountedRef.current) return;
  
      if (snap.exists) {
        const data = snap.data() || {};
        
        // ✅ FIX: Unified point calculation
        const points = calculateTotalPoints(data);
        const levelInfo = calculateLevelInfo(points);
  
        const updatedProfile = {
          name: data.displayName || authUser?.displayName || "Người dùng",
          level: levelInfo.level,
          points: points,
          completedTasks: getCompletedTaskCount(data),
          viewedGuides: data.viewedGuides || 0,
          assistantQuestions: data.assistantQuestions || 0,
          levelTitle: levelInfo.title,
          isMaxLevel: levelInfo.isMaxLevel,
          pointsForNext: levelInfo.pointsForNext
        };
  
        setProfile(updatedProfile);
        setLevelProgress(levelInfo.progress);
  
        // ✅ FIX: Safe animation update
        if (isMountedRef.current) {
          Animated.parallel([
            Animated.timing(pointsAnimValue, {
              toValue: points,
              duration: 1000,
              useNativeDriver: false,
            }),
            Animated.timing(levelAnimValue, {
              toValue: levelInfo.level,
              duration: 800,
              useNativeDriver: false,
            })
          ]).start();
        }
  
        // Update avatar
        if (data.photoURL && data.photoURL !== authUser?.photoURL) {
          setAvatarUrl(data.photoURL);
        }
  
        // Update level in Firestore if changed
        if (data.level !== levelInfo.level || data.calculatedPoints !== points) {
          firestore().collection("users").doc(uid).update({
            level: levelInfo.level,
            calculatedPoints: points,
            lastLevelUpdate: firestore.FieldValue.serverTimestamp()
          }).catch(error => {
            console.error("Error updating user level:", error);
          });
        }
      } else {
        setProfile(prev => ({
          ...prev,
          name: authUser?.displayName || "Người dùng",
        }));
      }
    } catch (error) {
      console.error("Header › fetchUserProfile", error);
      
      if (isMountedRef.current) {
        setProfile(prev => ({
          ...prev,
          name: authUser?.displayName || "Người dùng",
        }));
      }
    } finally {
      loadingStateRef.current = false;
      setIsLoading(false);
    }
  }, [calculateLevelInfo]);
  const calculateTotalPoints = useCallback((userData) => {
    if (!userData || typeof userData !== 'object') {
      return 0;
    }
    
    let totalPoints = 0;
    
    // Base points
    totalPoints += (userData.points || 0);
    
    // Points from tasks - use unified method
    totalPoints += getCompletedTaskCount(userData) * 50;
    
    // Points from guides
    totalPoints += (userData.viewedGuides || 0) * 20;
    
    // Points from assistant questions
    totalPoints += (userData.assistantQuestions || 0) * 10;
    
    return Math.max(0, Math.floor(totalPoints));
  }, []);
  const AnimatedText = ({ children, style }) => {
    const [displayValue, setDisplayValue] = useState(0);
    
    useEffect(() => {
      const listener = animatedPoints.addListener(({ value }) => {
        if (isMountedRef.current) {
          setDisplayValue(Math.floor(value));
        }
      });
      
      return () => {
        animatedPoints.removeListener(listener);
      };
    }, []);
    
    return (
      <Text style={style}>
        {displayValue}đ
      </Text>
    );
  };
  
  const getCompletedTaskCount = useCallback((userData) => {
    if (!userData?.completedTasks || !Array.isArray(userData.completedTasks)) {
      return 0;
    }
    
    const uniqueTasks = new Set(
      userData.completedTasks.filter(task => 
        task && typeof task === 'string' && task.trim().length > 0
      )
    );
    
    return uniqueTasks.size;
  }, []);
  // Reset profile state
  const resetProfile = useCallback(() => {
    setProfile({
      name: "Người dùng",
      level: 1,
      points: 0,
      completedTasks: 0,
      viewedGuides: 0,
      assistantQuestions: 0,
    });
    setAvatarUrl(null);
    setLevelProgress(0);
    pointsAnimValue.setValue(0);
    levelAnimValue.setValue(1);
  }, [pointsAnimValue, levelAnimValue]);

  // Auth state listener
  useEffect(() => {
    isMountedRef.current = true;
    
    const unsubscribe = auth().onAuthStateChanged(async (u) => {
      if (!isMountedRef.current) return;
      
      setUser(u);
      
      if (!u) {
        resetProfile();
        return;
      }
  
      setAvatarUrl(u.photoURL);
      await fetchUserProfile(u.uid, u);
    });
  
    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [fetchUserProfile, resetProfile]);

  // Back button handler
  const handleBack = useCallback(() => {
    if (onBackPress) return onBackPress();
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [onBackPress, navigation]);

  // Enhanced user press handler with level info
  const handleUserPress = useCallback(() => {
    if (!user) return navigation.navigate("Login");

    const userEmail = getUserDisplayEmail(user);
    const levelInfo = calculateLevelInfo(profile.points);
    
    const alertMessage = [
      `Tên: ${profile.name}`,
      userEmail ? `Email: ${userEmail}` : null,
      `Cấp độ: ${profile.level} - ${levelInfo.title}`,
      `Điểm: ${profile.points.toLocaleString()}`,
      levelInfo.isMaxLevel ? '🏆 Đã đạt cấp độ tối đa!' : `Cần ${levelInfo.pointsForNext} điểm để lên cấp`,
      ``,
      `📋 Nhiệm vụ hoàn thành: ${profile.completedTasks}`,
      `📖 Hướng dẫn đã xem: ${profile.viewedGuides}`,
      `💬 Câu hỏi với trợ lý: ${profile.assistantQuestions}`
    ].filter(Boolean).join('\n');
    
    Alert.alert(
      "Thông tin người dùng",
      alertMessage,
      [
        { text: "Đóng", style: "cancel" },
        { text: "Cài đặt", onPress: () => navigation.navigate("Setting") },
        { text: "Xem thành tích", onPress: () => showAchievements() },
      ]
    );
  }, [user, profile, navigation, calculateLevelInfo]);

  // Show achievements modal
  const showAchievements = useCallback(() => {
    const achievements = [];
    
    if (profile.completedTasks >= 10) {
      achievements.push("🏅 Người thực hiện xuất sắc");
    }
    if (profile.viewedGuides >= 20) {
      achievements.push("📚 Người ham học hỏi");
    }
    if (profile.assistantQuestions >= 50) {
      achievements.push("💭 Người tò mò");
    }
    if (profile.level >= 5) {
      achievements.push("⭐ Chuyên gia công nghệ");
    }
    if (profile.points >= 1000) {
      achievements.push("💰 Triệu phú điểm số");
    }

    const achievementText = achievements.length > 0 
      ? achievements.join('\n') 
      : "Chưa có thành tích nào. Hãy tiếp tục sử dụng ứng dụng!";

    Alert.alert(
      "🏆 Thành tích của bạn",
      achievementText,
      [{ text: "Tuyệt vời!", style: "default" }]
    );
  }, [profile]);

  // Helper function để lấy email hiển thị phù hợp
  const getUserDisplayEmail = useCallback((authUser) => {
    if (!authUser?.email) return null;
    
    // Filter out temporary/fake emails
    const excludePatterns = ['@temp.local', '@example.com', '@placeholder.'];
    const email = authUser.email.toLowerCase();
    
    if (excludePatterns.some(pattern => email.includes(pattern))) {
      return null;
    }
    
    return authUser.email;
  }, []);

  // Memoized scaled function
  const scaled = useMemo(() => 
    (size) => (getScaledSize ? getScaledSize(size) : size), 
    [getScaledSize]
  );

  // Memoized styles
  const styles = useMemo(() => createStyles({ backgroundColor, scaled }), [backgroundColor, scaled]);

  // Animated values for display
  const animatedPoints = pointsAnimValue.interpolate({
    inputRange: [0, Math.max(profile.points, 1)],
    outputRange: [0, profile.points],
    extrapolate: 'clamp'
  });

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {showBackButton && (
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Ionicons
            name={Platform.OS === "ios" ? "chevron-back" : "arrow-back"}
            size={scaled(24)}
            color="#fff"
          />
        </TouchableOpacity>
      )}

      {/* Brand */}
      <View style={styles.brand}>
        <View style={styles.logoCircle}>
          <Image source={app} style={styles.logoImage} />
        </View>
        <View style={styles.brandText}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Right */}
      <View style={styles.right}>
        {rightComponent ? (
          rightComponent
        ) : (
          <TouchableOpacity
            style={styles.userBtn}
            onPress={handleUserPress}
            accessibilityRole="button"
            accessibilityLabel={user ? "Thông tin người dùng" : "Đăng nhập"}
          >
            {user ? (
              <>
                <View style={styles.userInfo}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {profile.name}
                  </Text>
                  <View style={styles.userStatsRow}>
                    <Text style={styles.userLevel} numberOfLines={1}>
                      Lv. {profile.level}
                    </Text>
                    <Animated.Text style={styles.userPoints}>
                      {animatedPoints.__getValue ? Math.floor(animatedPoints.__getValue()) : profile.points}đ
                    </Animated.Text>
                  </View>
                  {/* Level progress bar */}
                  {!profile.isMaxLevel && (
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${levelProgress * 100}%` }]} />
                    </View>
                  )}
                </View>
                <View style={styles.avatarWrap}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                  ) : (
                    <Ionicons name="person" size={scaled(20)} color="#fff" />
                  )}
                  {/* Level badge */}
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>{profile.level}</Text>
                  </View>
                  {/* Loading indicator */}
                  {isLoading && (
                    <View style={styles.loadingOverlay}>
                      <View style={styles.loadingDot} />
                    </View>
                  )}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.loginTxt}>Đăng nhập</Text>
                <Ionicons name="log-in-outline" size={scaled(20)} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles({ backgroundColor, scaled }) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 18,
      backgroundColor,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3,
    },
    backBtn: {
      marginRight: 8,
      padding: 4,
    },
    brand: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      minWidth: 0,
    },
    logoCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "#fff",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    logoImage: {
      width: 28,
      height: 28,
      borderRadius: 14,  // nếu muốn bo tròn
      resizeMode: "contain",
    },
    logoText: {
      fontWeight: "800",
      fontSize: scaled(16),
      color: backgroundColor,
    },
    brandText: {
      minWidth: 0,
    },
    title: {
      fontSize: scaled(18),
      fontWeight: "700",
      color: "#fff",
      maxWidth: 160,
    },
    subtitle: {
      fontSize: scaled(12),
      color: "#fff",
      opacity: 0.9,
      marginTop: 1,
    },
    right: {
      alignItems: "flex-end",
      marginLeft: 12,
    },
    userBtn: {
      flexDirection: "row",
      alignItems: "center",
    },
    userInfo: {
      alignItems: "flex-end",
      marginRight: 8,
      maxWidth: 140,
    },
    userName: {
      fontSize: scaled(14),
      color: "#fff",
      fontWeight: "600",
    },
    userStatsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 2,
    },
    userLevel: {
      fontSize: scaled(11),
      color: "#fff",
      backgroundColor: "rgba(255,255,255,0.2)",
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 8,
      marginRight: 4,
      fontWeight: "600",
    },
    userPoints: {
      fontSize: scaled(11),
      color: "#fff",
      fontWeight: "500",
    },
    progressBar: {
      width: 60,
      height: 3,
      backgroundColor: "rgba(255,255,255,0.3)",
      borderRadius: 1.5,
      marginTop: 3,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: "#FFD700",
      borderRadius: 1.5,
    },
    avatarWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.2)",
      justifyContent: "center",
      alignItems: "center",
      overflow: "visible",
      position: "relative",
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
    },
    levelBadge: {
      position: "absolute",
      bottom: -3,
      right: -3,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "#FFD700",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#fff",
    },
    levelBadgeText: {
      fontSize: scaled(10),
      fontWeight: "bold",
      color: "#333",
    },
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.8)",
      justifyContent: "center",
      alignItems: "center",
    },
    loadingDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: backgroundColor,
      opacity: 0.7,
    },
    loginTxt: {
      fontSize: scaled(12),
      color: "#fff",
      marginRight: 6,
    },
  });
}
