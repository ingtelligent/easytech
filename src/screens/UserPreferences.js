import { useState, useEffect, useRef } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const UserPreferences = () => {
  const [preferences, setPreferences] = useState({
    fontSizeAddition: 0,
    dialect: 'north',
    gender: 'female',
  });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Refs for managing state and preventing race conditions
  const isMountedRef = useRef(true);
  const loadingRef = useRef({
    user: false,
    guest: false,
  });
  const updateQueueRef = useRef([]);
  const isProcessingUpdateRef = useRef(false);

  // Base font sizes for different elements
  const baseSizes = {
    small: 12,
    normal: 16,
    medium: 18,
    large: 20,
    xlarge: 24,
    xxlarge: 28
  };

  // Calculate current font size with additive approach
  const getCurrentFontSize = (baseSize = baseSizes.normal) => {
    return baseSize + preferences.fontSizeAddition;
  };

  // Helper function to get scaled sizes
  const getScaledSize = (baseSize) => {
    return baseSize + preferences.fontSizeAddition;
  };

  // Enhanced migration logic with better validation
  const convertIndexToAddition = (fontSizeIndex) => {
    if (fontSizeIndex === undefined || fontSizeIndex === null) return 0;
    
    // ✅ FIX: Enhanced validation
    if (typeof fontSizeIndex !== 'number' || !isFinite(fontSizeIndex)) {
      console.warn('Invalid fontSizeIndex type or value:', fontSizeIndex);
      return 0;
    }
  
    // Clamp value to valid range
    const clampedIndex = Math.max(0, Math.min(4, Math.floor(fontSizeIndex)));
    
    const indexToAdditionMap = {
      0: -4, // Very small
      1: -2, // Small  
      2: 0,  // Medium (default)
      3: 4,  // Large
      4: 8   // Very large
    };
    
    const result = indexToAdditionMap[clampedIndex];
    if (result === undefined) {
      console.warn('Unexpected fontSizeIndex after clamping:', clampedIndex);
      return 0;
    }
    
    return result;
  };

  // Enhanced preferences validation
  const validatePreferences = (prefs) => {
    if (!prefs || typeof prefs !== 'object') {
      return false;
    }
  
    // ✅ FIX: Validate fontSizeAddition với proper range
    if (typeof prefs.fontSizeAddition === 'number') {
      if (prefs.fontSizeAddition < -8 || prefs.fontSizeAddition > 16) {
        console.warn('fontSizeAddition out of range:', prefs.fontSizeAddition);
        return false;
      }
    } else if (prefs.fontSizeIndex !== undefined) {
      // Legacy support với validation
      if (typeof prefs.fontSizeIndex !== 'number' || 
          prefs.fontSizeIndex < 0 || prefs.fontSizeIndex > 4) {
        console.warn('fontSizeIndex out of range:', prefs.fontSizeIndex);
        return false;
      }
    } else {
      console.warn('No valid font size property found');
      return false;
    }
  
    // ✅ FIX: Validate dialect với strict checking
    const validDialects = ['north', 'central', 'south'];
    if (!prefs.dialect || !validDialects.includes(prefs.dialect)) {
      console.warn('Invalid dialect:', prefs.dialect);
      return false;
    }
  
    // ✅ FIX: Validate gender với strict checking
    const validGenders = ['male', 'female'];
    if (!prefs.gender || !validGenders.includes(prefs.gender)) {
      console.warn('Invalid gender:', prefs.gender);
      return false;
    }
  
    return true;
  };

  // Enhanced user preferences loading with retry mechanism
  const loadUserPreferences = async (userId, retryCount = 0) => {
    if (!userId || typeof userId !== 'string' || loadingRef.current.user) {
      return;
    }

    loadingRef.current.user = true;
    setError(null);
  
    try {
      console.log(`Loading user preferences for: ${userId} (attempt ${retryCount + 1})`);
      
      // ✅ FIX: Use appropriate cache strategy based on retry count
      const cacheStrategy = retryCount > 0 ? 'server' : 'default';
      const docSnap = await firestore()
        .collection('users')
        .doc(userId)
        .get({ source: cacheStrategy });
      
      if (!isMountedRef.current) return;
  
      if (docSnap.exists) {
        const data = docSnap.data();
        console.log('User document data loaded:', data);
        
        if (data && typeof data === 'object') {
          let preferencesToLoad = null;
  
          // Try to load from preferences field first
          if (data.preferences && validatePreferences(data.preferences)) {
            preferencesToLoad = {
              dialect: data.preferences.dialect,
              gender: data.preferences.gender,
              fontSizeAddition: data.preferences.fontSizeAddition !== undefined 
                ? data.preferences.fontSizeAddition 
                : convertIndexToAddition(data.preferences.fontSizeIndex)
            };
          } 
          // Fallback to root level fields (legacy support)
          else {
            const legacyPrefs = {
              dialect: data.dialect || 'north',
              gender: data.gender || 'female',
              fontSizeAddition: data.fontSizeAddition !== undefined 
                ? data.fontSizeAddition 
                : convertIndexToAddition(data.fontSizeIndex)
            };
  
            if (validatePreferences(legacyPrefs)) {
              preferencesToLoad = legacyPrefs;
              
              // ✅ FIX: Async migration to prevent blocking
              setTimeout(async () => {
                try {
                  await firestore()
                    .collection('users')
                    .doc(userId)
                    .set({ 
                      preferences: preferencesToLoad,
                      migrationDate: firestore.FieldValue.serverTimestamp(),
                      migratedFrom: 'root-level-fields'
                    }, { merge: true });
                  console.log('Successfully migrated preferences to new structure');
                } catch (migrationError) {
                  console.warn('Failed to migrate preferences (non-critical):', migrationError);
                }
              }, 1000);
            }
          }
  
          if (preferencesToLoad) {
            setPreferences(prev => ({
              ...prev,
              ...preferencesToLoad
            }));
            console.log('User preferences loaded successfully:', preferencesToLoad);
            return; // Success, exit function
          } else {
            throw new Error('No valid preferences found in user document');
          }
        } else {
          throw new Error('Invalid user document structure');
        }
      } else {
        console.log('User document does not exist, creating defaults');
        await createDefaultUserPreferences(userId);
        return; // Success, exit function
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
      
      // ✅ FIX: Enhanced retry logic với different strategies
      if (retryCount < 2 && isMountedRef.current) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`Retrying preference load in ${delay}ms...`);
        
        setTimeout(() => {
          if (isMountedRef.current) {
            loadUserPreferences(userId, retryCount + 1);
          }
        }, delay);
        return;
      }
  
      // Final fallback after all retries failed
      setError(`Không thể tải cài đặt: ${error.message}`);
      const defaultPreferences = {
        fontSizeAddition: 0,
        dialect: 'north',
        gender: 'female',
      };
      
      setPreferences(prev => ({ ...prev, ...defaultPreferences }));
      console.warn('Using default preferences due to persistent errors');
    } finally {
      if (isMountedRef.current) {
        loadingRef.current.user = false;
      }
    }
  };

  // Create default user preferences with transaction
  const createDefaultUserPreferences = async (userId) => {
    const defaultPreferences = {
      fontSizeAddition: 0,
      dialect: 'north',
      gender: 'female',
    };

    try {
      // Use transaction to ensure data consistency
      await firestore().runTransaction(async (transaction) => {
        const userRef = firestore().collection('users').doc(userId);
        const doc = await transaction.get(userRef);

        if (!doc.exists) {
          transaction.set(userRef, {
            preferences: defaultPreferences,
            createdAt: firestore.FieldValue.serverTimestamp(),
          });
        } else {
          transaction.update(userRef, {
            preferences: defaultPreferences,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
        }
      });

      setPreferences(prev => ({ ...prev, ...defaultPreferences }));
      console.log('Default preferences created successfully');
    } catch (error) {
      console.error('Error creating default preferences:', error);
      setPreferences(prev => ({ ...prev, ...defaultPreferences }));
    }
  };

  // Enhanced guest preferences loading
  const loadGuestPreferences = async (retryCount = 0) => {
    if (loadingRef.current.guest) return;

    loadingRef.current.guest = true;
    setError(null);

    try {
      console.log('Loading guest preferences from AsyncStorage');
      
      const storedPreferences = await AsyncStorage.getItem('userPreferences');
      
      if (!isMountedRef.current) return;

      if (storedPreferences && storedPreferences.trim() !== '') {
        try {
          const parsed = JSON.parse(storedPreferences);
          console.log('Found stored guest preferences:', parsed);
          
          if (validatePreferences(parsed)) {
            const validatedPreferences = {
              dialect: parsed.dialect,
              gender: parsed.gender,
              fontSizeAddition: parsed.fontSizeAddition !== undefined 
                ? parsed.fontSizeAddition 
                : convertIndexToAddition(parsed.fontSizeIndex)
            };
            
            setPreferences(prev => ({
              ...prev,
              ...validatedPreferences
            }));
            
            console.log('Guest preferences loaded successfully:', validatedPreferences);
          } else {
            throw new Error('Invalid stored preferences structure');
          }
        } catch (parseError) {
          console.error('Error parsing stored preferences:', parseError);
          
          // Clear corrupted data and retry once
          if (retryCount === 0) {
            await AsyncStorage.removeItem('userPreferences');
            return loadGuestPreferences(1);
          }
          
          throw parseError;
        }
      } else {
        console.log('No stored guest preferences found, using defaults');
      }
    } catch (error) {
      console.error('Error loading guest preferences:', error);
      setError(error.message);
      
      // Set defaults even on error
      const defaultPreferences = {
        fontSizeAddition: 0,
        dialect: 'north',
        gender: 'female',
      };
      
      setPreferences(prev => ({ ...prev, ...defaultPreferences }));
    } finally {
      loadingRef.current.guest = false;
    }
  };

  // Enhanced update preferences with queue and transaction support
  const updatePreferences = async (newPreferences) => {
    try {
      if (!newPreferences || typeof newPreferences !== 'object') {
        console.warn('Invalid preferences provided to updatePreferences:', newPreferences);
        return;
      }

      // Add to update queue
      updateQueueRef.current.push(newPreferences);
      
      // Process queue if not already processing
      if (!isProcessingUpdateRef.current) {
        await processUpdateQueue();
      }
    } catch (error) {
      console.error('Error queueing preference update:', error);
      setError(error.message);
    }
  };

  // Process update queue to prevent race conditions
  const processUpdateQueue = async () => {
    if (isProcessingUpdateRef.current || updateQueueRef.current.length === 0) {
      return;
    }
  
    isProcessingUpdateRef.current = true;
    let retryCount = 0;
    const maxRetries = 3;
  
    try {
      // ✅ FIX: Merge all queued updates safely
      const mergedUpdates = updateQueueRef.current.reduce((acc, update) => {
        // Validate each update before merging
        if (update && typeof update === 'object') {
          return { ...acc, ...update };
        }
        console.warn('Invalid update in queue:', update);
        return acc;
      }, {});
      
      // Clear queue immediately to prevent reprocessing
      updateQueueRef.current = [];
  
      // Validate merged updates
      const currentPrefs = { ...preferences };
      const updatedPrefs = { ...currentPrefs, ...mergedUpdates };
  
      if (!validatePreferences(updatedPrefs)) {
        throw new Error('Invalid preferences after merge validation');
      }
  
      console.log('Processing preference updates:', updatedPrefs);
      
      // Update local state immediately for better UX
      setPreferences(updatedPrefs);
  
      // ✅ FIX: Retry logic for persistence
      while (retryCount < maxRetries) {
        try {
          if (user && user.uid) {
            await saveUserPreferences(user.uid, updatedPrefs);
          } else {
            await saveGuestPreferences(updatedPrefs);
          }
          break; // Success, exit retry loop
        } catch (saveError) {
          retryCount++;
          console.error(`Error saving preferences (attempt ${retryCount}):`, saveError);
          
          if (retryCount < maxRetries) {
            // Exponential backoff
            const delay = Math.pow(2, retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw saveError; // Max retries reached
          }
        }
      }
  
      console.log('Preferences updated successfully');
      setError(null); // Clear any previous errors
      
    } catch (error) {
      console.error('Error processing preference updates:', error);
      setError(error.message);
      
      // ✅ FIX: Revert local state on persistent failure
      // But don't revert if it's just a save failure - keep the UI updated
      if (error.message.includes('validation')) {
        setPreferences(preferences);
      }
    } finally {
      isProcessingUpdateRef.current = false;
      
      // ✅ FIX: Process any new updates that came in, với debounce
      if (updateQueueRef.current.length > 0) {
        setTimeout(() => {
          if (isMountedRef.current && !isProcessingUpdateRef.current) {
            processUpdateQueue();
          }
        }, 500); // Debounce for 500ms
      }
    }
  };

  // Save user preferences with transaction
  const saveUserPreferences = async (userId, prefs) => {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId for saving preferences');
    }
    
    if (!validatePreferences(prefs)) {
      throw new Error('Invalid preferences data for saving');
    }
  
    try {
      // ✅ FIX: Use transaction với proper error handling
      await firestore().runTransaction(async (transaction) => {
        const userRef = firestore().collection('users').doc(userId);
        const doc = await transaction.get(userRef);
  
        const updateData = {
          preferences: prefs,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        };
  
        if (doc.exists) {
          transaction.update(userRef, updateData);
        } else {
          transaction.set(userRef, {
            ...updateData,
            createdAt: firestore.FieldValue.serverTimestamp(),
          });
        }
      });
  
      console.log('User preferences saved to Firestore successfully');
    } catch (error) {
      console.error('Error saving preferences to Firestore:', error);
      
      // ✅ FIX: Provide more specific error messages
      if (error.code === 'permission-denied') {
        throw new Error('Không có quyền lưu cài đặt. Vui lòng đăng nhập lại.');
      } else if (error.code === 'unavailable') {
        throw new Error('Không thể kết nối server. Vui lòng thử lại.');
      } else {
        throw new Error(`Lỗi lưu cài đặt: ${error.message}`);
      }
    }
  };
  
  const saveGuestPreferences = async (prefs, retryCount = 0) => {
    if (!validatePreferences(prefs)) {
      throw new Error('Invalid preferences data for guest saving');
    }
  
    try {
      const prefsString = JSON.stringify(prefs);
      await AsyncStorage.setItem('userPreferences', prefsString);
      console.log('Guest preferences saved to AsyncStorage successfully');
    } catch (error) {
      console.error(`Error saving preferences to AsyncStorage (attempt ${retryCount + 1}):`, error);
      
      if (retryCount < 2) {
        // Retry with exponential backoff
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return saveGuestPreferences(prefs, retryCount + 1);
      } else {
        throw new Error(`Không thể lưu cài đặt local: ${error.message}`);
      }
    }
  };
  

  // Enhanced auth state change handler
  useEffect(() => {
    let isMounted = true;
    isMountedRef.current = true;
    
    const unsubscribe = auth().onAuthStateChanged(async (userState) => {
      try {
        console.log('Auth state changed:', userState?.uid || 'null');
        
        if (!isMounted) return;
        
        setUser(userState);
        setLoading(true);
        setError(null);
        
        if (userState && userState.uid) {
          await loadUserPreferences(userState.uid);
        } else {
          await loadGuestPreferences();
        }
      } catch (error) {
        console.error('Error in auth state change handler:', error);
        setError(error.message);
        
        // Set defaults on error
        if (isMounted) {
          setPreferences({
            fontSizeAddition: 0,
            dialect: 'north',
            gender: 'female',
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      isMountedRef.current = false;
      unsubscribe();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      loadingRef.current = { user: false, guest: false };
      updateQueueRef.current = [];
      isProcessingUpdateRef.current = false;
    };
  }, []);

  // Helper function to get scaled sizes by category
  const getFontSize = (category = 'normal') => {
    const baseSize = baseSizes[category] || baseSizes.normal;
    return getScaledSize(baseSize);
  };

  // Helper function to get responsive spacing
  const getScaledSpacing = (baseSpacing) => {
    const scaleFactor = 1 + (preferences.fontSizeAddition / 32);
    return Math.round(baseSpacing * scaleFactor);
  };

  // Helper function to get responsive icon sizes
  const getIconSize = (baseIconSize) => {
    return getScaledSize(baseIconSize);
  };

  // Helper function for component-specific sizes
  const getComponentSizes = () => {
    const safeAddition = Math.max(-8, Math.min(16, preferences.fontSizeAddition || 0));
    
    return {
      // Text sizes với safe bounds
      title: Math.max(14, getFontSize('large')),
      subtitle: Math.max(12, getFontSize('medium')),
      body: Math.max(10, getFontSize('normal')),
      caption: Math.max(8, getFontSize('small')),
      button: Math.max(12, getFontSize('normal')),
      
      // Icon sizes với reasonable limits
      iconSmall: Math.max(12, Math.min(24, getIconSize(16))),
      iconMedium: Math.max(16, Math.min(32, getIconSize(20))),
      iconLarge: Math.max(20, Math.min(40, getIconSize(24))),
      iconXLarge: Math.max(24, Math.min(48, getIconSize(32))),
      
      // Spacing với reasonable limits
      paddingSmall: Math.max(4, Math.min(16, getScaledSpacing(8))),
      paddingMedium: Math.max(8, Math.min(32, getScaledSpacing(16))),
      paddingLarge: Math.max(12, Math.min(48, getScaledSpacing(24))),
      marginSmall: Math.max(2, Math.min(8, getScaledSpacing(4))),
      marginMedium: Math.max(4, Math.min(16, getScaledSpacing(8))),
      marginLarge: Math.max(8, Math.min(32, getScaledSpacing(16))),
      
      // Component specific với safe bounds
      buttonHeight: Math.max(32, Math.min(64, getScaledSpacing(44))),
      inputHeight: Math.max(28, Math.min(56, getScaledSpacing(40))),
      cardPadding: Math.max(8, Math.min(32, getScaledSpacing(16))),
      borderRadius: Math.max(4, Math.min(16, getScaledSpacing(8))),
    };
  };

  // Get current font size level description
  const getFontSizeDescription = () => {
    const addition = preferences.fontSizeAddition;
    switch (addition) {
      case -4: return 'Rất nhỏ';
      case -2: return 'Nhỏ';
      case 0: return 'Trung bình';
      case 2: return 'Lớn';
      case 4: return 'Rất lớn';
      case 8: return 'Cực lớn';
      default: return 'Tùy chỉnh';
    }
  };

  // Reset preferences to defaults
  const resetToDefaults = async () => {
    const defaultPreferences = {
      fontSizeAddition: 0,
      dialect: 'north',
      gender: 'female',
    };

    await updatePreferences(defaultPreferences);
  };

  // Export preferences data
  const exportPreferences = () => {
    return {
      ...preferences,
      timestamp: new Date().toISOString(),
      version: '1.0',
    };
  };

  // Import preferences data
  const importPreferences = async (importedData) => {
    try {
      if (!importedData || typeof importedData !== 'object') {
        throw new Error('Invalid import data format');
      }

      const prefsToImport = {
        fontSizeAddition: importedData.fontSizeAddition ?? 0,
        dialect: importedData.dialect ?? 'north',
        gender: importedData.gender ?? 'female',
      };

      if (!validatePreferences(prefsToImport)) {
        throw new Error('Invalid preferences in import data');
      }

      await updatePreferences(prefsToImport);
      return true;
    } catch (error) {
      console.error('Error importing preferences:', error);
      setError(error.message);
      return false;
    }
  };

  return {
    // Core data
    preferences,
    user,
    loading,
    error,
    
    // Core functions
    updatePreferences,
    resetToDefaults,
    exportPreferences,
    importPreferences,
    
    // Font size functions
    getCurrentFontSize,
    getScaledSize,
    getFontSize,
    getScaledSpacing,
    getIconSize,
    getComponentSizes,
    
    // Utility functions
    getFontSizeDescription,
    convertIndexToAddition,
    validatePreferences,
    
    // Convenience properties
    fontSizeAddition: preferences.fontSizeAddition,
    currentFontSize: getCurrentFontSize(),
    baseFontSize: baseSizes.normal,
  };
};

export default UserPreferences;