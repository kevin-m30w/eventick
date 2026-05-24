export default defineNuxtRouteMiddleware(async (to, from) => {
  const supabase = useSupabaseClient() as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return navigateTo("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "organizer") {
    return navigateTo("/settings");
  }
});
