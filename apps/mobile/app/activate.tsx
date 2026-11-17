import { Redirect } from 'expo-router';

/** Codes are gone: old links (sali://activate, the bot's buttons) open the subscription tab. */
export default function ActivateRedirect() { return <Redirect href="/subscription" />; }
