/**
 * Formats a duration in a human-readable countdown string (e.g., "2h 45m left" or "Expired")
 */
export function formatTimeRemaining(expiresAt: string | null): string {
    if (!expiresAt) return "Permanent";

    const expiry = new Date(expiresAt).getTime();
    const now = new Date().getTime();
    const diff = expiry - now;

    if (diff <= 0) return "Expired";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `Expires in ${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
        return `Expires in ${minutes}m`;
    }

    return "Expiring soon";
}
