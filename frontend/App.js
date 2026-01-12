import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Modal, 
  ScrollView,
  RefreshControl,
  SafeAreaView,
  Animated,
  Switch
} from 'react-native';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api';

export default function App() {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [logs, setLogs] = useState('');
  const [stats, setStats] = useState(null);
  const [containerStats, setContainerStats] = useState({});
  const [logsModal, setLogsModal] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [glowAnim] = useState(new Animated.Value(0));
  const [actionLoading, setActionLoading] = useState(false);
  const [showComposeMenu, setShowComposeMenu] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchContainers();
    
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchContainers();
      }
    }, 5000);

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchContainers = async () => {
    try {
      const res = await axios.get(`${API_URL}/containers`);
      setContainers(res.data);
      
      const runningContainers = res.data.filter(c => c.state === 'running');
      const statsPromises = runningContainers.map(container => 
        axios.get(`${API_URL}/containers/${container.name}/stats`)
          .then(statsRes => ({ name: container.name, stats: statsRes.data }))
          .catch(() => ({ name: container.name, stats: null }))
      );
      
      const allStats = await Promise.all(statsPromises);
      const statsMap = {};
      allStats.forEach(({ name, stats }) => {
        if (stats) statsMap[name] = stats;
      });
      setContainerStats(statsMap);
    } catch (e) {
      console.error('Error fetching containers:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogsAndStats = async (container) => {
    setSelectedContainer(container);
    setLogsLoading(true);
    setLogsModal(true);
    
    try {
      const logsRes = await axios.get(`${API_URL}/containers/${container.name}/logs?tail=50`);
      setLogs(logsRes.data.logs || 'No logs available');
      
      if (container.state === 'running') {
        const statsRes = await axios.get(`${API_URL}/containers/${container.name}/stats`);
        setStats(statsRes.data);
      } else {
        setStats(null);
      }
    } catch (e) {
      console.error('Error fetching logs/stats:', e);
      setLogs('Error fetching logs');
      setStats(null);
    } finally {
      setLogsLoading(false);
    }
  };

  const statusColor = (state) => {
    if (state === 'running') return '#28a745';
    if (state === 'exited') return '#dc3545';
    if (state === 'restarting') return '#ffc107';
    return '#6c757d';
  };

  const getContainerIcon = (name) => {
    if (name.includes('express')) return { icon: 'EXP', name: 'Express API', color: darkMode ? '#00ff41' : '#28a745' };
    if (name.includes('dotnet')) return { icon: 'NET', name: '.NET Core', color: darkMode ? '#00d9ff' : '#512bd4' };
    if (name.includes('nextjs')) return { icon: 'NXT', name: 'Next.js', color: darkMode ? '#00ffff' : '#000000' };
    if (name.includes('mongodb')) return { icon: 'MDB', name: 'MongoDB', color: darkMode ? '#00ff88' : '#47a248' };
    if (name.includes('postgresql')) return { icon: 'PG', name: 'PostgreSQL', color: darkMode ? '#00b4ff' : '#336791' };
    return { icon: 'CNT', name: name, color: darkMode ? '#00ff41' : '#666' };
  };

  const parsePercentage = (percentStr) => {
    return parseFloat(percentStr?.replace('%', '') || '0');
  };

  const showConfirmation = (title, message, onConfirm) => {
    setConfirmModal({ visible: true, title, message, onConfirm });
  };

  const hideConfirmation = () => {
    setConfirmModal({ visible: false, title: '', message: '', onConfirm: null });
  };

  const handleContainerAction = async (containerName, action) => {
    setActionLoading(true);
    try {
      let response;
      if (action === 'delete') {
        response = await axios.delete(`${API_URL}/containers/${containerName}?volumes=true`);
      } else {
        response = await axios.post(`${API_URL}/containers/${containerName}/${action}`);
      }
      
      await fetchContainers();
      
      if (action === 'delete' && selectedContainer?.name === containerName) {
        closeModal();
      }
    } catch (e) {
      console.error(`Error ${action} container:`, e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleComposeAction = async (action) => {
    setActionLoading(true);
    setShowComposeMenu(false);
    try {
      let response;
      if (action === 'up') {
        response = await axios.post(`${API_URL}/compose/up`);
      } else if (action === 'down') {
        response = await axios.post(`${API_URL}/compose/down?removeOrphans=true`);
      } else if (action === 'rebuild') {
        response = await axios.post(`${API_URL}/compose/rebuild`);
      }
      
      await fetchContainers();
    } catch (e) {
      console.error(`Error compose ${action}:`, e);
    } finally {
      setActionLoading(false);
    }
  };

  const ProgressBar = ({ value, max = 100, color, label, darkMode }) => {
    const percentage = (value / max) * 100;
    const glowColor = percentage > 80 ? (darkMode ? '#ff0040' : '#dc3545') : 
                      percentage > 50 ? (darkMode ? '#ffaa00' : '#ffc107') : 
                      (darkMode ? '#00ff41' : '#28a745');
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressInfo}>
          <Text style={[styles.progressLabel, darkMode && styles.darkText]}>{label}</Text>
          <Text style={[styles.progressValue, darkMode && styles.darkTextBright, { color: glowColor }]}>
            {typeof value === 'number' ? `${value.toFixed(1)}%` : value}
          </Text>
        </View>
        <View style={[styles.progressBarBg, darkMode && styles.progressBarBgDark]}>
          <View 
            style={[
              styles.progressBarFill, 
              { 
                width: `${Math.min(percentage, 100)}%`, 
                backgroundColor: glowColor,
                shadowColor: glowColor,
                shadowOpacity: darkMode ? 0.8 : 0.5,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 0 },
              }
            ]} 
          />
        </View>
      </View>
    );
  };

  const renderContainer = ({ item }) => {
    const itemStats = containerStats[item.name];
    const containerInfo = getContainerIcon(item.name);
    const isRunning = item.state === 'running';
    const glowOpacity = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    });
    
    return (
      <TouchableOpacity 
        style={[
          styles.containerCard,
          darkMode && styles.containerCardDark,
          isRunning && darkMode && styles.containerCardRunning
        ]}
        onPress={() => fetchLogsAndStats(item)}
      >
        <View style={styles.containerHeader}>
          <View style={styles.containerInfo}>
            <Animated.View 
              style={[
                styles.containerIconBox,
                { 
                  backgroundColor: containerInfo.color, 
                  opacity: isRunning ? glowOpacity : 1,
                  shadowColor: containerInfo.color,
                  shadowOpacity: isRunning ? 0.6 : 0,
                  shadowRadius: 8,
                }
              ]}
            >
              <Text style={styles.containerIconText}>{containerInfo.icon}</Text>
            </Animated.View>
            <View>
              <Text style={[styles.containerName, darkMode && styles.darkTextBright]}>
                {containerInfo.name}
              </Text>
              <Text style={[styles.containerImage, darkMode && styles.darkTextMuted]}>
                {item.image}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { 
            backgroundColor: statusColor(item.state),
            borderColor: statusColor(item.state),
            borderWidth: darkMode ? 1 : 0,
          }]}>
            <Text style={styles.statusText}>{item.state.toUpperCase()}</Text>
          </View>
        </View>
        
        {itemStats && isRunning && (
          <View style={[styles.statsSection, darkMode && styles.statsSectionDark]}>
            <ProgressBar 
              value={parsePercentage(itemStats.cpu)} 
              label="CPU Usage"
              darkMode={darkMode}
            />
            <ProgressBar 
              value={parsePercentage(itemStats.memory.percent)} 
              label="Memory Usage"
              darkMode={darkMode}
            />
          </View>
        )}
        
        {item.ports && item.ports.length > 0 && (
          <View style={[styles.portsContainer, darkMode && styles.portsContainerDark]}>
            <Text style={[styles.portsTitle, darkMode && styles.darkTextMuted]}>
              PORTS: {item.ports.map(p => p.public || p.private).filter(Boolean).join(', ')}
            </Text>
          </View>
        )}
        
        <View style={[styles.containerActions, darkMode && styles.containerActionsDark]}>
          {isRunning && (
            <TouchableOpacity 
              style={[styles.actionButton, darkMode && styles.actionButtonDark]}
              onPress={(e) => { 
                e.stopPropagation(); 
                showConfirmation(
                  'STOP CONTAINER',
                  `Stop ${item.name}?\n\nThe container will be stopped but not removed.`,
                  () => handleContainerAction(item.name, 'stop')
                );
              }}
              disabled={actionLoading}
            >
              <Text style={[styles.actionButtonText, darkMode && styles.darkTextBright]}>■ STOP</Text>
            </TouchableOpacity>
          )}
          {isRunning && (
            <TouchableOpacity 
              style={[styles.actionButton, darkMode && styles.actionButtonDark]}
              onPress={(e) => { 
                e.stopPropagation(); 
                showConfirmation(
                  'RESTART CONTAINER',
                  `Restart ${item.name}?\n\nThe container will be stopped and started again.`,
                  () => handleContainerAction(item.name, 'restart')
                );
              }}
              disabled={actionLoading}
            >
              <Text style={[styles.actionButtonText, darkMode && styles.darkTextBright]}>↻ RESTART</Text>
            </TouchableOpacity>
          )}
          {!isRunning && (
            <TouchableOpacity 
              style={[styles.actionButton, darkMode && styles.actionButtonDark]}
              onPress={(e) => { 
                e.stopPropagation(); 
                showConfirmation(
                  'START CONTAINER',
                  `Start ${item.name}?`,
                  () => handleContainerAction(item.name, 'start')
                );
              }}
              disabled={actionLoading}
            >
              <Text style={[styles.actionButtonText, darkMode && styles.darkTextBright]}>▶ START</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButtonStyle, darkMode && styles.deleteButtonDark]}
            onPress={(e) => { 
              e.stopPropagation(); 
              showConfirmation(
                'DELETE CONTAINER',
                `Are you sure you want to delete ${item.name} with all volumes?\n\nThis action cannot be undone.`,
                () => handleContainerAction(item.name, 'delete')
              );
            }}
            disabled={actionLoading}
          >
            <Text style={[styles.actionButtonText, darkMode && styles.deleteButtonTextDark]}>🗑 DELETE</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const closeModal = () => {
    setLogsModal(false);
    setSelectedContainer(null);
    setLogs('');
    setStats(null);
  };

  return (
    <SafeAreaView style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={[styles.header, darkMode && styles.headerDark]}>
        <View style={styles.headerTop}>
          <Animated.Text style={[styles.title, darkMode && styles.titleDark, { opacity: glowAnim }]}>
            &gt; DOCKER MONITOR
          </Animated.Text>
          <View style={styles.modeToggle}>
            <Text style={[styles.modeLabel, darkMode && styles.darkTextMuted]}>
              {darkMode ? 'DARK' : 'LIGHT'}
            </Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#767577', true: '#00ff41' }}
              thumbColor={darkMode ? '#0a0' : '#f4f3f4'}
            />
          </View>
        </View>
        <Text style={[styles.subtitle, darkMode && styles.subtitleDark]}>
          <Text style={darkMode && { color: '#00ff41' }}>[</Text>
          BJIT-NETWORK
          <Text style={darkMode && { color: '#00ff41' }}>]</Text>
          {' '}{containers.length} ACTIVE CONTAINERS
        </Text>
        <TouchableOpacity 
          style={[styles.refreshToggle, darkMode && styles.refreshToggleDark]}
          onPress={() => setAutoRefresh(!autoRefresh)}
        >
          <Text style={[styles.refreshText, darkMode && styles.darkTextBright]}>
            {autoRefresh ? 'AUTO-REFRESH ON' : 'AUTO-REFRESH OFF'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.composeButton, darkMode && styles.composeButtonDark]}
          onPress={() => setShowComposeMenu(!showComposeMenu)}
        >
          <Text style={[styles.composeButtonText, darkMode && styles.darkTextBright]}>
            DOCKER COMPOSE ▼
          </Text>
        </TouchableOpacity>
        
        {showComposeMenu && (
          <View style={[styles.composeMenu, darkMode && styles.composeMenuDark]}>
            <TouchableOpacity 
              style={[styles.composeMenuItem, darkMode && styles.composeMenuItemDark]}
              onPress={() => handleComposeAction('up')}
              disabled={actionLoading}
            >
              <Text style={[styles.composeMenuText, darkMode && styles.darkTextBright]}>
                ▶ START ALL (compose up -d)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.composeMenuItem, darkMode && styles.composeMenuItemDark]}
              onPress={() => handleComposeAction('rebuild')}
              disabled={actionLoading}
            >
              <Text style={[styles.composeMenuText, darkMode && styles.darkTextBright]}>
                🔨 REBUILD (compose up --build -d)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.composeMenuItem, darkMode && styles.composeMenuItemDark]}
              onPress={() => {
                showConfirmation(
                  'STOP ALL SERVICES',
                  'This will stop all Docker Compose services.\n\nContinue?',
                  () => handleComposeAction('down')
                );
              }}
              disabled={actionLoading}
            >
              <Text style={[styles.composeMenuText, darkMode && styles.darkTextBright]}>
                ■ STOP ALL (compose down)
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={darkMode ? "#00ff41" : "#007bff"} />
          <Text style={[styles.loadingText, darkMode && styles.darkTextBright]}>
            SCANNING NETWORK...
          </Text>
        </View>
      ) : (
        <FlatList
          data={containers}
          keyExtractor={item => item.id}
          renderItem={renderContainer}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl 
              refreshing={loading} 
              onRefresh={fetchContainers}
              tintColor={darkMode ? "#00ff41" : "#007bff"}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, darkMode && styles.darkTextMuted]}>
              NO CONTAINERS DETECTED
            </Text>
          }
        />
      )}

      <Modal 
        visible={logsModal} 
        animationType="slide" 
        onRequestClose={closeModal}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, darkMode && styles.modalContainerDark]}>
          <View style={[styles.modalHeader, darkMode && styles.modalHeaderDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.darkTextBright]}>
              {selectedContainer ? `> ${getContainerIcon(selectedContainer.name).name.toUpperCase()}` : '> CONTAINER DETAILS'}
            </Text>
            <TouchableOpacity 
              style={[styles.closeButton, darkMode && styles.closeButtonDark]} 
              onPress={closeModal}
            >
              <Text style={[styles.closeButtonText, darkMode && styles.darkTextBright]}>X CLOSE</Text>
            </TouchableOpacity>
          </View>

          {logsLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={darkMode ? "#00ff41" : "#007bff"} />
              <Text style={[styles.loadingText, darkMode && styles.darkTextBright]}>
                FETCHING DATA...
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.modalContent}>
              {stats && (
                <View style={[styles.statsContainer, darkMode && styles.statsContainerDark]}>
                  <Text style={[styles.statsTitle, darkMode && styles.darkTextBright]}>
                    RESOURCE MONITORING
                  </Text>
                  <ProgressBar 
                    value={parsePercentage(stats.cpu)} 
                    label="CPU Usage"
                    darkMode={darkMode}
                  />
                  <ProgressBar 
                    value={parsePercentage(stats.memory.percent)} 
                    label="Memory Usage"
                    darkMode={darkMode}
                  />
                  <Text style={[styles.memoryDetails, darkMode && styles.darkTextMuted]}>
                    {stats.memory.usage} / {stats.memory.limit}
                  </Text>
                </View>
              )}

              <View style={styles.logsContainer}>
                <Text style={[styles.logsTitle, darkMode && styles.darkTextBright]}>
                  CONTAINER LOGS [LAST 50 LINES]
                </Text>
                <ScrollView 
                  style={[styles.logsBox, darkMode && styles.logsBoxDark]}
                  horizontal={true}
                  nestedScrollEnabled={true}
                >
                  <Text style={[styles.logsText, darkMode && styles.logsTextDark]}>{logs}</Text>
                </ScrollView>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={confirmModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={hideConfirmation}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmBox, darkMode && styles.confirmBoxDark]}>
            <Text style={[styles.confirmTitle, darkMode && styles.darkTextBright]}>
              &gt; {confirmModal.title}
            </Text>
            <Text style={[styles.confirmMessage, darkMode && styles.darkText]}>
              {confirmModal.message}
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonCancel, darkMode && styles.confirmButtonCancelDark]}
                onPress={hideConfirmation}
              >
                <Text style={[styles.confirmButtonText, darkMode && styles.darkText]}>
                  CANCEL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonConfirm, darkMode && styles.confirmButtonConfirmDark]}
                onPress={() => {
                  hideConfirmation();
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                }}
              >
                <Text style={styles.confirmButtonTextConfirm}>
                  CONFIRM
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  screenDark: {
    backgroundColor: '#0a0a0a',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerDark: {
    backgroundColor: '#0d0d0d',
    borderBottomColor: '#00ff41',
    borderBottomWidth: 2,
    shadowColor: '#00ff41',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  title: {
    fontSize: 20,
  composeButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 10,
    alignItems: 'center',
  },
  composeButtonDark: {
    backgroundColor: '#0a0a0a',
    borderWidth: 2,
    borderColor: '#00ff41',
    shadowColor: '#00ff41',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  composeButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  composeMenu: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  composeMenuDark: {
    backgroundColor: '#0d0d0d',
    borderColor: '#00ff41',
    borderWidth: 2,
  },
  composeMenuItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  composeMenuItemDark: {
    borderBottomColor: '#1a1a1a',
  },
  composeMenuText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  containerActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  containerActionsDark: {
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 12,
  },
  actionButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  actionButtonDark: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#00ff41',
  },
  deleteButtonStyle: {
    backgroundColor: '#e0e0e0',
  },
  actionButtonText: {
    color: '#333',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
    fontWeight: 'bold',
    color: '#1a1a1a',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  titleDark: {
    color: '#00ff41',
    textShadowColor: '#00ff41',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 11,
    color: '#666',
    marginBottom: 10,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  subtitleDark: {
    color: '#0a0',
  },
  refreshToggle: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 5,
    alignItems: 'center',
  },
  refreshToggleDark: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#00ff41',
  },
  refreshText: {
    color: '#333',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  listContainer: {
    padding: 10,
  },
  containerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  containerCardDark: {
    backgroundColor: '#111111',
    borderColor: '#1a1a1a',
    shadowColor: '#00ff41',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  containerCardRunning: {
    borderColor: '#00ff41',
    borderWidth: 1,
  },
  containerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  containerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  containerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerIconText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  containerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  containerImage: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  statsSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statsSectionDark: {
    backgroundColor: '#0d0d0d',
    borderColor: '#1a1a1a',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  progressValue: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarBgDark: {
    backgroundColor: '#1a1a1a',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  portsContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f0f2f5',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#007bff',
  },
  portsContainerDark: {
    backgroundColor: '#0d0d0d',
    borderLeftColor: '#00ff41',
  },
  portsTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginTop: 50,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  darkText: {
    color: '#ccc',
  },
  darkTextMuted: {
    color: '#666',
  },
  darkTextBright: {
    color: '#00ff41',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContainerDark: {
    backgroundColor: '#0a0a0a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
  },
  modalHeaderDark: {
    backgroundColor: '#0d0d0d',
    borderBottomColor: '#00ff41',
    shadowColor: '#00ff41',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  closeButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  closeButtonDark: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#00ff41',
  },
  closeButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 10,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  modalContent: {
    flex: 1,
    padding: 15,
  },
  statsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 15,
    marginHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statsContainerDark: {
    backgroundColor: '#0d0d0d',
    borderColor: '#1a1a1a',
  },
  statsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 15,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  memoryDetails: {
    fontSize: 10,
    color: '#666',
    marginTop: 8,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  logsContainer: {
    flex: 1,
    marginHorizontal: 15,
  },
  logsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 10,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  logsBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    padding: 12,
    minHeight: 400,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  logsBoxDark: {
    backgroundColor: '#000000',
    borderColor: '#1a1a1a',
  },
  logsText: {
    color: '#333',
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 18,
  },
  logsTextDark: {
    color: '#00ff41',
  },
  deleteButtonDark: {
    backgroundColor: '#1a1a1a',
    borderColor: '#ff0040',
    borderWidth: 1,
  },
  deleteButtonTextDark: {
    color: '#ff0040',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  confirmBoxDark: {
    backgroundColor: '#0d0d0d',
    borderColor: '#00ff41',
    shadowColor: '#00ff41',
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1a1a1a',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  confirmMessage: {
    fontSize: 13,
    marginBottom: 24,
    lineHeight: 20,
    color: '#333',
    fontFamily: 'monospace',
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 2,
  },
  confirmButtonCancel: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ccc',
  },
  confirmButtonCancelDark: {
    backgroundColor: '#1a1a1a',
    borderColor: '#666',
  },
  confirmButtonConfirm: {
    backgroundColor: '#ff0040',
    borderColor: '#ff0040',
  },
  confirmButtonConfirmDark: {
    backgroundColor: '#ff0040',
    borderColor: '#ff0040',
    shadowColor: '#ff0040',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  confirmButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
    color: '#333',
  },
  confirmButtonTextConfirm: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
    color: '#fff',
  },
});
