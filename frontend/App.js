import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Modal, ScrollView } from 'react-native';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api';

export default function App() {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLogs, setSelectedLogs] = useState(null);
  const [logsModal, setLogsModal] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    fetchContainers();
  }, []);

  const fetchContainers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/containers`);
      setContainers(res.data);
    } catch (e) {
      setContainers([]);
    }
    setLoading(false);
  };

  const fetchLogs = async (id) => {
    setLogsLoading(true);
    setLogsModal(true);
    try {
      const res = await axios.get(`${API_URL}/containers/${id}/logs`);
      setSelectedLogs(res.data || res);
    } catch (e) {
      setSelectedLogs('Error fetching logs');
    }
    setLogsLoading(false);
  };

  const statusColor = (state) => {
    if (state === 'running') return 'green';
    return 'red';
  };

  const renderItem = ({ item }) => (
    <View style={styles.containerItem}>
      <View style={styles.row}>
        <View style={[styles.statusDot, { backgroundColor: statusColor(item.state) }]} />
        <Text style={styles.name}>{item.name}</Text>
      </View>
      <TouchableOpacity style={styles.logButton} onPress={() => fetchLogs(item.id)}>
        <Text style={styles.logButtonText}>View Logs</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Docker Containers</Text>
      {loading ? <ActivityIndicator size="large" /> : (
        <FlatList
          data={containers}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          onRefresh={fetchContainers}
          refreshing={loading}
        />
      )}
      <Modal visible={logsModal} animationType="slide" onRequestClose={() => setLogsModal(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Container Logs</Text>
          {logsLoading ? <ActivityIndicator size="large" /> : (
            <ScrollView style={styles.logsBox}>
              <Text style={styles.logsText}>{selectedLogs}</Text>
            </ScrollView>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={() => setLogsModal(false)}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 50, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  containerItem: { backgroundColor: '#f2f2f2', margin: 10, borderRadius: 8, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 16, height: 16, borderRadius: 8, marginRight: 10 },
  name: { fontSize: 18, fontWeight: '500' },
  logButton: { backgroundColor: '#007bff', padding: 8, borderRadius: 6 },
  logButtonText: { color: '#fff', fontWeight: 'bold' },
  modalContent: { flex: 1, padding: 20, backgroundColor: '#fff', justifyContent: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  logsBox: { backgroundColor: '#222', borderRadius: 8, padding: 10, minHeight: 200, marginBottom: 20 },
  logsText: { color: '#fff', fontFamily: 'monospace' },
  closeButton: { backgroundColor: '#dc3545', padding: 10, borderRadius: 6, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontWeight: 'bold' }
});
