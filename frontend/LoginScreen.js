import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from './AuthContext';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState('');
  
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Login Failed', result.error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0a0a0a',
    },
    backgroundGradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: '#0a0a0a', // Dark background
    },
    loginContainer: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: 'rgba(26, 26, 26, 0.95)',
      borderRadius: 20,
      padding: 30,
      shadowColor: '#00ffff',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 20,
      borderWidth: 1,
      borderColor: 'rgba(0, 255, 255, 0.3)',
    },
    logo: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#00ffff',
      textAlign: 'center',
      marginBottom: 10,
      textShadowColor: '#00ffff',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
    subtitle: {
      fontSize: 16,
      color: '#888',
      textAlign: 'center',
      marginBottom: 40,
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      color: '#00ffff',
      marginBottom: 8,
      fontWeight: '600',
    },
    input: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 12,
      padding: 15,
      fontSize: 16,
      color: '#fff',
      borderWidth: 2,
      borderColor: 'rgba(0, 255, 255, 0.3)',
    },
    inputFocused: {
      borderColor: '#00ffff',
      backgroundColor: 'rgba(0, 255, 255, 0.1)',
      shadowColor: '#00ffff',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 5,
    },
    loginButton: {
      borderRadius: 12,
      padding: 15,
      marginTop: 20,
      shadowColor: '#00ffff',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 10,
    },
    loginButtonContent: {
      backgroundColor: '#00ffff',
      borderRadius: 12,
      padding: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loginButtonText: {
      color: '#000',
      fontSize: 18,
      fontWeight: 'bold',
    },
    loginButtonDisabled: {
      opacity: 0.6,
    },
    helpText: {
      textAlign: 'center',
      color: '#666',
      fontSize: 14,
      marginTop: 30,
      lineHeight: 20,
    },
    credentialsBox: {
      backgroundColor: 'rgba(0, 255, 255, 0.1)',
      borderRadius: 10,
      padding: 15,
      marginTop: 20,
      borderWidth: 1,
      borderColor: 'rgba(0, 255, 255, 0.3)',
    },
    credentialsTitle: {
      color: '#00ffff',
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 10,
    },
    credentialsText: {
      color: '#ccc',
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 16,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.backgroundGradient}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%', alignItems: 'center' }}
        >
          <View style={styles.loginContainer}>
            <Text style={styles.logo}>DNMonitor</Text>
            <Text style={styles.subtitle}>Docker Container Monitoring</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedInput === 'username' && styles.inputFocused
                ]}
                placeholder="Enter username"
                placeholderTextColor="#666"
                value={username}
                onChangeText={setUsername}
                onFocus={() => setFocusedInput('username')}
                onBlur={() => setFocusedInput('')}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedInput === 'password' && styles.inputFocused
                ]}
                placeholder="Enter password"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput('')}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[
                styles.loginButton,
                loading && styles.loginButtonDisabled
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              <View style={styles.loginButtonContent}>
                {loading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.loginButtonText}>LOGIN</Text>
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.credentialsBox}>
              <Text style={styles.credentialsTitle}>Demo Credentials</Text>
              <Text style={styles.credentialsText}>
                Admin: username "admin", password "admin123"{'\n'}
                Viewer: username "monitor", password "admin123"
              </Text>
            </View>

            <Text style={styles.helpText}>
              Secure access to your Docker container monitoring dashboard.{'\n'}
              JWT-based authentication with encrypted passwords.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}