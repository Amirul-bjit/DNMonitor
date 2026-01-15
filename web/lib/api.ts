import axios, { AxiosError } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

export interface Container {
  id: string
  name: string
  image: string
  state: string
  status: string
  ports: Array<{ private: number; public?: number; type: string }>
}

export interface ContainerStats {
  cpu: string
  memory: {
    used: string
    total: string
    percent: string
  }
  network: {
    rx: string
    tx: string
  }
}

export interface SystemStats {
  hostname: string
  platform: string
  arch: string
  cpu: {
    model: string
    cores: number
    percent: string
  }
  memory: {
    total: string
    used: string
    percent: string
  }
  disk: {
    total: string
    used: string
    percent: string
  }
}

export interface ContainerLogs {
  logs: string
}

// Error handling helper
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError
    if (axiosError.response) {
      return `API Error: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`
    } else if (axiosError.request) {
      return 'Network Error: Unable to reach the server. Please check if the backend is running.'
    }
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred'
}

// API Functions
export const fetchContainers = async (): Promise<Container[]> => {
  try {
    const response = await axios.get(`${API_URL}/containers`)
    return response.data || []
  } catch (error) {
    console.error('Error fetching containers:', handleApiError(error))
    throw new Error(handleApiError(error))
  }
}

export const fetchSystemStats = async (): Promise<SystemStats> => {
  try {
    const response = await axios.get(`${API_URL}/system/stats`)
    return response.data
  } catch (error) {
    console.error('Error fetching system stats:', handleApiError(error))
    throw new Error(handleApiError(error))
  }
}

export const fetchContainerStats = async (containerName: string): Promise<ContainerStats> => {
  try {
    const response = await axios.get(`${API_URL}/containers/${containerName}/stats`)
    return response.data
  } catch (error) {
    console.error(`Error fetching stats for ${containerName}:`, handleApiError(error))
    throw new Error(handleApiError(error))
  }
}

export const fetchContainerLogs = async (containerName: string, tail: number = 100): Promise<ContainerLogs> => {
  try {
    const response = await axios.get(`${API_URL}/containers/${containerName}/logs?tail=${tail}`)
    return response.data
  } catch (error) {
    console.error(`Error fetching logs for ${containerName}:`, handleApiError(error))
    throw new Error(handleApiError(error))
  }
}

export const containerAction = async (containerName: string, action: 'start' | 'stop' | 'restart'): Promise<void> => {
  try {
    await axios.post(`${API_URL}/containers/${containerName}/${action}`)
  } catch (error) {
    console.error(`Error ${action} container ${containerName}:`, handleApiError(error))
    throw new Error(handleApiError(error))
  }
}

export const deleteContainer = async (containerName: string): Promise<void> => {
  try {
    await axios.delete(`${API_URL}/containers/${containerName}?volumes=true`)
  } catch (error) {
    console.error(`Error deleting container ${containerName}:`, handleApiError(error))
    throw new Error(handleApiError(error))
  }
}

export const composeAction = async (action: 'up' | 'down' | 'rebuild'): Promise<void> => {
  try {
    if (action === 'up') {
      await axios.post(`${API_URL}/compose/up`)
    } else if (action === 'down') {
      await axios.post(`${API_URL}/compose/down?removeOrphans=true`)
    } else if (action === 'rebuild') {
      await axios.post(`${API_URL}/compose/rebuild`)
    }
  } catch (error) {
    console.error(`Error compose ${action}:`, handleApiError(error))
    throw new Error(handleApiError(error))
  }
}
