// Payments were removed from the store app (they live in the Telegram bot).
// This route only forwards old deep links; the file can be deleted.
import { Redirect } from 'expo-router';
export default function SubscriptionRedirect() { return <Redirect href="/activate" />; }
