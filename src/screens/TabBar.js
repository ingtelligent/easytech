import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { UserPreferences } from './UserPreferences';

const { width } = Dimensions.get('window');

const TabBar = ({ selectedTab, onTabPress }) => {
  const { currentFontSize, getScaledSize } = UserPreferences();

  const tabs = [
    {
      id: 'Home',
      title: 'Trang chủ',
      icon: 'home-outline',
      activeIcon: 'home',
    },
    {
      id: 'Tutorial',
      title: 'Hướng dẫn',
      icon: 'book-outline',
      activeIcon: 'book',
    },
    {
      id: 'Task',
      title: 'Nhiệm vụ',
      icon: 'checkmark-circle-outline',
      activeIcon: 'checkmark-circle',
    },
    {
      id: 'ChatBot',
      title: 'Trợ lý',
      icon: 'chatbubble-outline',
      activeIcon: 'chatbubble',
    },
    {
      id: 'Setting',
      title: 'Cài đặt',
      icon: 'person-outline',
      activeIcon: 'person',
    },
  ];

  // Create dynamic styles based on font size
  const dynamicStyles = StyleSheet.create({
    tabText: {
      fontSize: getScaledSize(12),
      marginTop: 4,
      textAlign: 'center',
      fontWeight: '500',
    },
    activeTabText: {
      fontSize: getScaledSize(12),
      marginTop: 4,
      textAlign: 'center',
      fontWeight: '600',
      color: '#00cc66',
    },
  });

  const renderTab = (tab) => {
    const isActive = selectedTab === tab.id;
    const iconSize = getScaledSize(24);

    return (
      <TouchableOpacity
        key={tab.id}
        style={[styles.tabItem, isActive && styles.activeTab]}
        onPress={() => onTabPress(tab.id)}
        activeOpacity={0.8}
        accessibilityLabel={`${tab.title} tab`}
        accessibilityRole="tab"
        accessibilityState={{
          selected: isActive,
        }}
      >
        <View style={styles.tabIconContainer}>
          <Ionicons
            name={isActive ? tab.activeIcon : tab.icon}
            size={iconSize}
            color={isActive ? '#00cc66' : '#666'}
          />
          {isActive && <View style={styles.activeIndicator} />}
        </View>
        <Text
          style={isActive ? dynamicStyles.activeTabText : { ...dynamicStyles.tabText, color: '#666' }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {tab.title}
        </Text>
        {isActive && <View style={styles.activeTabHighlight} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.shadowContainer}>
        <View style={styles.tabBar}>
          {tabs.map(renderTab)}
        </View>
      </View>
    </View>
  );
};

// Static styles that don't depend on font size
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  shadowContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 15,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 25 : 12,
    paddingHorizontal: 8,
    minHeight: Platform.OS === 'ios' ? 80 : 65,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 16,
    position: 'relative',
    minHeight: 52,
  },
  activeTab: {
    backgroundColor: '#f0fff0',
    transform: [{ translateY: -2 }],
  },
  tabIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00cc66',
  },
  activeTabHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#00cc66',
    opacity: 0.3,
  },
});

export default TabBar;