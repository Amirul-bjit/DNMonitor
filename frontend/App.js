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
  SafeAreaView
} from 'react-native';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api';

export default function App() {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [logs, setLogs] = useState('');
  const [stats, setStats] = useState(null);
  const [logsModal, setLogsModal] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchContainers();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchContainers();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchContainers = async () => {
    try {
      const res = await axios.get(`${API_URL}/containers`);
      setContainers(res.data);
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
      // Fetch logs
      const logsRes = await axios.get(`${API_URL}/containers/${container.name}/logs?tail=50`);
      setLogs(logsRes.data.logs || 'No logs available');
      
      // Fetch stats if container is running
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
    if (name.includes('express')) return '🟢 Express';
    if (name.includes('dotnet')) return '🔷 .NET';
    if (name.includes('nextjs')) return '⚫ Next.js';
    if (name.includes('mongodb')) return '🍃 MongoDB';
    if (name.includes('postgresql')) return '🐘 PostgreSQL';
    return '📦 ' + name;
  };

  const renderContainer = ({ item }) => (
    <TouchableOpacity 
      style={styles.containerCard}
      onPress={() => fetchLogsAndStats(item)}
    >
      <View style={styles.containerHeader}>
        <View style={styles.containerInfo}>
          <Text style={styles.containerName}>{getContainerIcon(item.name)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(item.state) }]}>
            <Text style={styles.statusText}>{item.state.toUpperCase()}</Text>
          </View>
        </View>
      </View>
      
      <Text style={styles.containerImage}>Image: {item.image}</Text>
      <Text style={styles.containerStatus}>{item.status}</Text>
      
      {item.ports && item.ports.length > 0 && (
        <View style={styles.portsContainer}>
          <Text style={styles.portsTitle}>Ports:</Text>
          {item.ports.map((port, idx) => (
            <Text key={idx} style={styles.portText}>
              {port.public ? `${port.public} → ` : ''}{port.private}/{port.type}
            </Text>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );

  const closeModal = () => {
    setLogsModal(false);
    setSelectedContainer(null);
    setLogs('');
    setStats(null);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>🐳 Docker Monitor</Text>
        <Text style={styles.subtitle}>BJIT Network - {containers.length} Containers</Text>
        <TouchableOpacity 
          style={styles.refreshToggle}
          onPress={() => setAutoRefresh(!autoRefresh)}
        >
          <Text style={styles.refreshText}>
            Auto-refresh: {autoRefresh ? '✅' : '❌'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
      ) : (
        <FlatList
          data={containers}
          keyExtractor={item => item.id}
          renderItem={renderContainer}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchContainers} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No containers found</Text>
          }
        />
      )}

      <Modal 
        visible={logsModal} 
        animationType="slide" 
        onRequestClose={closeModal}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedContainer ? getContainerIcon(selectedContainer.name) : 'Container Details'}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
              <Text style={styles.closeButtonText}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          {logsLoading ? (
            <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
          ) : (
            <ScrollView style={styles.modalContent}>
              {stats && (
                <View style={styles.statsContainer}>
                  <Text style={styles.statsTitle}>📊 Resource Usage</Text>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>CPU:</Text>
                    <Text style={styles.statValue}>{stats.cpu}</Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Memory:</Text>
                    <Text style={styles.statValue}>
                      {stats.memory.usage} / {stats.memory.limit} ({stats.memory.percent})
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.logsContainer}>
                <Text style={styles.logsTitle}>📝 Container Logs (Last 50 lines)</Text>
                <ScrollView 
                  style={styles.logsBox}
                  horizontal={true}
                  nestedScrollEnabled={true}
                >
                  <Text style={styles.logsText}>{logs}</Text>
                </ScrollView>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007bff',
    padding: 20,
    paddingTop: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#e3f2fd',
    marginBottom: 10,
  },
  refreshToggle: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginTop: 5,
  },
  refreshText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loader: {
    marginTop: 50,
  },
  listContainer: {
    padding: 10,
  },
  containerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    gap: 10,
  },
  containerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  containerImage: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  containerStatus: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  portsContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
  },
  portsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 4,
  },
  portText: {
    fontSize: 11,
    color: '#6c757d',
    fontFamily: 'monospace',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#999',
    marginTop: 50,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#007bff',
    borderBottomWidth: 1,
    borderBottomColor: '#0056b3',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalContent: {
    flex: 1,
    padding: 15,
  },
  statsContainer: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0d47a1',
    marginBottom: 10,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#1565c0',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    color: '#424242',
    fontFamily: 'monospace',
  },
  logsContainer: {
    flex: 1,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  logsBox: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    minHeight: 400,
  },
  logsText: {
    color: '#d4d4d4',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
});
