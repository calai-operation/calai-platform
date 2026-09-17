import {useQuery} from '@tanstack/react-query';
import Cookies from 'js-cookie';

export function useOperationsReport(period) {
  return useQuery({
    queryKey: ['admin-operations', period.start, period.end],
    refetchInterval: 30000,
    retry: 1,
    queryFn: async ({signal}) => {
      const base = import.meta.env.VITE_API_BASE_URL || 'https://api.calai.info/api';
      const response = await fetch(base + '/system-owner/dashboard/operations?' + new URLSearchParams(period), {
        signal, headers: {Authorization: 'Bearer ' + Cookies.get('Access-Token')},
      });
      const body = await response.json();
      if (!response.ok) throw Object.assign(Error(body.message || 'Unable to load reports.'), {status: response.status});
      return body.data;
    },
  });
}
