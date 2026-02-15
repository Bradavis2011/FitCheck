import api from '../lib/api';

export const pushNotificationService = {
  async registerToken(token: string, platform: 'ios' | 'android') {
    const response = await api.post<{ success: boolean; message: string }>(
      '/api/push/register',
      { token, platform }
    );
    return response.data;
  },

  async unregisterToken(token: string) {
    const response = await api.delete<{ success: boolean; message: string }>(
      '/api/push/register',
      { data: { token } }
    );
    return response.data;
  },
};
