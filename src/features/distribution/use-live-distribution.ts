import { useEffect, useMemo, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import {
    calculateDistribution,
    DEFAULT_TICK_SAMPLE,
    DistributionTick,
} from './distribution-engine';

type ActiveSymbol = {
    symbol: string;
    display_name?: string;
    market?: string;
    [key: string]: unknown;
};

type LiveDistributionState = {
    ticks: DistributionTick[];
    loading: boolean;
    error: string;
};

export const useLiveDistribution = (symbol: string, barrier: number, sampleSize = DEFAULT_TICK_SAMPLE) => {
    const [state, setState] = useState<LiveDistributionState>({
        ticks: [],
        loading: false,
        error: '',
    });

    useEffect(() => {
        if (!symbol || !api_base.api) {
            setState({ ticks: [], loading: false, error: '' });
            return;
        }

        let active = true;
        let subscriptionId: string | undefined;
        const api = api_base.api;
        setState({ ticks: [], loading: true, error: '' });

        const messageSubscription = api.onMessage().subscribe(({ data }: any) => {
            if (!active || data?.msg_type !== 'tick' || data?.tick?.symbol !== symbol) return;
            const nextTick = { quote: Number(data.tick.quote), epoch: Number(data.tick.epoch) };
            if (!Number.isFinite(nextTick.quote)) return;
            setState(previous => ({
                ...previous,
                loading: false,
                ticks: [...previous.ticks, nextTick].slice(-sampleSize),
            }));
        });

        const historyRequest = api.send({
            ticks_history: symbol,
            count: sampleSize,
            end: 'latest',
            style: 'ticks',
            subscribe: 1,
        }) as unknown as Promise<any>;
        historyRequest.then((response: any) => {
            if (!active) {
                const id = response?.subscription?.id;
                if (id) api.send({ forget: id });
                return;
            }
            if (response?.error) {
                setState(previous => ({ ...previous, loading: false, error: response.error.message || 'Unable to load tick history.' }));
                return;
            }
            subscriptionId = response?.subscription?.id;
            const prices: number[] = response?.history?.prices || [];
            const times: number[] = response?.history?.times || [];
            const history = prices.map((quote, index) => ({
                quote: Number(quote),
                epoch: Number(times[index]),
            })).filter(tick => Number.isFinite(tick.quote));
            setState(previous => ({
                ...previous,
                loading: false,
                ticks: [...history, ...previous.ticks].slice(-sampleSize),
            }));
        }).catch((error: unknown) => {
            if (active) {
                setState(previous => ({
                    ...previous,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Unable to load live ticks.',
                }));
            }
        });

        return () => {
            active = false;
            messageSubscription.unsubscribe();
            if (subscriptionId) api.send({ forget: subscriptionId });
        };
    }, [symbol, sampleSize]);

    const activeSymbols = (api_base.active_symbols || []) as ActiveSymbol[];
    const symbolDetails = useMemo(
        () => activeSymbols.find(item => item.symbol === symbol),
        [activeSymbols, symbol]
    );
    const pipSize = (api_base.pip_sizes as Record<string, number> | undefined)?.[symbol];
    const snapshot = useMemo(
        () => calculateDistribution(state.ticks, barrier, pipSize, sampleSize),
        [state.ticks, barrier, pipSize, sampleSize]
    );

    return { ...state, snapshot, symbolDetails, activeSymbols };
};
