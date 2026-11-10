import { api_base } from '@/external/bot-skeleton';
import { DistributionTick } from './distribution-engine';
import { doUntilDone } from '@/external/bot-skeleton/services/tradeEngine/utils/helpers';

export type DistributionFeedState = {
    ticks: DistributionTick[];
    loading: boolean;
    error: string;
};

type Feed = DistributionFeedState & {
    api: NonNullable<typeof api_base.api>;
    listeners: Set<(state: DistributionFeedState) => void>;
    messageSubscription: { unsubscribe: () => void };
    subscriptionId?: string;
};

const feeds = new Map<string, Feed>();

const publish = (feed: Feed) => {
    const snapshot: DistributionFeedState = {
        ticks: [...feed.ticks],
        loading: feed.loading,
        error: feed.error,
    };
    feed.listeners.forEach(listener => listener(snapshot));
};

const mergeTicks = (history: DistributionTick[], live: DistributionTick[], sampleSize: number) => {
    const sameTick = (left: DistributionTick, right: DistributionTick) =>
        left.quote === right.quote && left.epoch === right.epoch;
    const maxOverlap = Math.min(history.length, live.length);
    let overlap = 0;
    for (let size = maxOverlap; size > 0; size -= 1) {
        const historySuffix = history.slice(-size);
        const livePrefix = live.slice(0, size);
        if (historySuffix.every((tick, index) => sameTick(tick, livePrefix[index]))) {
            overlap = size;
            break;
        }
    }
    return [...history, ...live.slice(overlap)].slice(-sampleSize);
};

export const subscribeDistributionFeed = (
    symbol: string,
    sampleSize: number,
    listener: (state: DistributionFeedState) => void
) => {
    const api = api_base.api;
    if (!api || !symbol) {
        listener({ ticks: [], loading: false, error: 'Deriv connection is not ready.' });
        return () => undefined;
    }

    const key = `${symbol}:${sampleSize}`;
    let feed = feeds.get(key);
    if (feed && feed.api === api) {
        feed.listeners.add(listener);
        listener({ ticks: [...feed.ticks], loading: feed.loading, error: feed.error });
        return () => {
            feed?.listeners.delete(listener);
            if (feed && feed.listeners.size === 0) {
                feed.messageSubscription.unsubscribe();
                if (feed.subscriptionId) doUntilDone(() => api.send({ forget: feed.subscriptionId }), [], api_base);
                feeds.delete(key);
            }
        };
    }

    if (feed) {
        feed.messageSubscription.unsubscribe();
        if (feed.subscriptionId) doUntilDone(() => feed.api.send({ forget: feed.subscriptionId }), [], api_base);
        feeds.delete(key);
    }

    const listeners = new Set<(state: DistributionFeedState) => void>([listener]);
    const messageSubscription = api.onMessage().subscribe(({ data }: any) => {
        const current = feeds.get(key);
        if (!current || data?.msg_type !== 'tick' || data?.tick?.symbol !== symbol) return;
        const tick = { quote: Number(data.tick.quote), epoch: Number(data.tick.epoch) };
        if (!Number.isFinite(tick.quote)) return;
        current.ticks = [...current.ticks, tick].slice(-sampleSize);
        current.loading = false;
        publish(current);
    });

    feed = {
        api,
        ticks: [],
        loading: true,
        error: '',
        listeners,
        messageSubscription,
    };
    feeds.set(key, feed);
    publish(feed);

    const historyRequest = doUntilDone(() => api.send({
        ticks_history: symbol,
        count: sampleSize,
        end: 'latest',
        style: 'ticks',
        subscribe: 1,
    }), [], api_base);

    historyRequest.then(response => {
        const current = feeds.get(key);
        if (!current || current.api !== api) {
            const id = response?.subscription?.id;
            if (id) doUntilDone(() => api.send({ forget: id }), [], api_base);
            return;
        }
        if (response?.error) {
            current.loading = false;
            current.error = response.error.message || 'Unable to load tick history.';
            publish(current);
            return;
        }
        current.subscriptionId = response?.subscription?.id;
        const prices: number[] = response?.history?.prices || [];
        const times: number[] = response?.history?.times || [];
        const history = prices.map((quote, index) => ({
            quote: Number(quote),
            epoch: Number(times[index]),
        })).filter(tick => Number.isFinite(tick.quote));
        current.ticks = mergeTicks(history, current.ticks, sampleSize);
        current.loading = false;
        publish(current);
    }).catch((error: unknown) => {
        const current = feeds.get(key);
        if (!current) return;
        current.loading = false;
        current.error = error instanceof Error ? error.message : 'Unable to load live ticks.';
        publish(current);
    });

    return () => {
        const current = feeds.get(key);
        if (!current) return;
        current.listeners.delete(listener);
        if (current.listeners.size === 0) {
            current.messageSubscription.unsubscribe();
            if (current.subscriptionId) current.api.send({ forget: current.subscriptionId });
            feeds.delete(key);
        }
    };
};
