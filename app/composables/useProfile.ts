export const useProfile = () => {
  const user = useSupabaseUser();
  const client = useSupabaseClient();

  const profile = useState("user-profile", () => null);
  const loading = useState("profile-loading", () => false);

  async function fetchProfile() {
    const userId = user.value?.sub || user.value?.id;

    if (!userId) {
      profile.value = null;
      return;
    }

    console.log("Found real ID:", userId);

    loading.value = true;

    const { data, error } = await client
      .from("profiles")
      .select("email, role")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching profile from DB:", error.message);
      profile.value = null;
    } else {
      profile.value = data;
    }

    loading.value = false;
  }

  watch(
    user,
    () => {
      fetchProfile();
    },
    { immediate: true },
  );

  return {
    profile,
    loading,
    user,
    fetchProfile,
  };
};
