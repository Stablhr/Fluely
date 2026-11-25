import {useMutation, useQueryClient} from '@tanstack/react-query';
import {getMe, logout} from '@/lib/api/authApi';
import {clearSocialCache} from '@/lib/kali/store/storage';
import {meQueryKey} from './useMeQuery';

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      const me = queryClient.getQueryData<Awaited<ReturnType<typeof getMe>>>(meQueryKey);
      clearSocialCache(me?.user.id);
      await queryClient.invalidateQueries({queryKey: meQueryKey});
      await queryClient.resetQueries({queryKey: meQueryKey});
    }
  });
}