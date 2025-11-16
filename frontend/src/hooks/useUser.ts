import { useEffect, useState } from 'react';
import api from '../api/axios';

export interface UserInfo {
  userId: number;
  loginId: string;
  userName: string;
  createdAt: string;
  updatedAt: string;
}

export const useUser = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await api.get<UserInfo>('/users/me');
        if (data !== null) {
          setUser(data);
        }
      } catch (error) {
        console.error('유저 정보 불러오기 실패:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  return { user, loading };
};
