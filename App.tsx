import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// import Splash from './src/screens/Splash';
import Home from './src/screens/Home';
import Tutorial from './src/screens/Tutorials/Tutorial';
import TutorialDetails from './src/screens/Tutorials/TutorialDetails';
import Task from './src/screens/Tasks/Task';
import TaskTutorial from './src/screens/Tasks/TaskTutorial';
import ChatBot from './src/screens/ChatBot/ChatBot';
import Setting from './src/screens/Setting/Setting';
import Login from './src/screens/Account/Login';
import SignUp from './src/screens/Account/SignUp';

const Stack = createNativeStackNavigator();

const App = () => {
  return (
      <NavigationContainer>
        <Stack.Navigator>
          {/* <Stack.Screen name="Splash" component={Splash} options={{ headerShown: false }} /> */}
          <Stack.Screen name="Home" component={Home} options={{ headerShown: false }} />
          <Stack.Screen name="Tutorial" component={Tutorial} options={{ headerShown: false }} />
          <Stack.Screen name="TutorialDetails" component={TutorialDetails} options={{ headerShown: false }} />
          <Stack.Screen name="Task" component={Task} options={{ headerShown: false }} />
          <Stack.Screen name="TaskTutorial" component={TaskTutorial} options={{ headerShown: false }} />
          <Stack.Screen name="ChatBot" component={ChatBot} options={{ headerShown: false }} />
          <Stack.Screen name="Setting" component={Setting} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
          <Stack.Screen name="SignUp" component={SignUp} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
  );
};

export default App;