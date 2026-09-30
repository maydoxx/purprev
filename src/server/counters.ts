type Counter = {
    name: string;
    last: number;
    avg: number;
    samples: number;
    at: number;
};

const KEEP = 200;
const counters = new Map<string, Counter>();

export const report = (name: string, value: number) => {
    const c = counters.get(name);
    if (!c) {
        counters.set(name, {
            name,
            last: value,
            avg: value,
            samples: 1,
            at: Date.now()
        });
    } else {
        c.last = value;
        c.avg += (value - c.avg) / Math.min(c.samples + 1, KEEP);
        c.samples++;
        c.at = Date.now();
    }
};

export const reported = () => [...counters.values()].sort((a, b) => a.name.localeCompare(b.name));
