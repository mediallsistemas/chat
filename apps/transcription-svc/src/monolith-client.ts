import axios, { AxiosInstance } from 'axios'
import { MeetingReadDtoSchema, MeetingReadDto } from '@mediall/contracts'
import { config } from './config'
import { logger } from './logger'

const http: AxiosInstance = axios.create({
  baseURL: config.MONOLITH_INTERNAL_URL,
  timeout: 5000,
  headers: { 'x-internal-token': config.MONOLITH_INTERNAL_TOKEN },
})

export async function fetchMeeting(meetingId: string): Promise<MeetingReadDto | null> {
  try {
    const { data } = await http.get(`/internal/v1/meetings/${meetingId}`)
    return MeetingReadDtoSchema.parse(data)
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null
    logger.error({ err, meetingId }, 'failed to fetch meeting from monolith')
    throw err
  }
}
