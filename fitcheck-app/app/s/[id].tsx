import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function SharedOutfitRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (id) {
      router.replace(`/feedback?outfitId=${id}` as any);
    }
  }, [id]);

  return null;
}
