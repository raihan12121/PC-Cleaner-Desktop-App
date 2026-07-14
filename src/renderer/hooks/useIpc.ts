import { useState, useCallback } from 'react';

/**
 * A handy hook to manage IPC call states (loading, error, data).
 */
export function useIpc<T = any>(channel: string) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const invoke = useCallback(async (...args: any[]) => {
        setLoading(true);
        setError(null);
        try {
            const result = await window.api.invoke(channel, ...args);
            if (result && result.error) {
                throw new Error(result.error);
            }
            setData(result);
            return result;
        } catch (err: any) {
            setError(err.message || 'Unknown error');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [channel]);

    return { invoke, data, loading, error, setData };
}
