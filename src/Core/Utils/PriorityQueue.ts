import { IComparable } from '../Interfaces/Comparable';

export default class PriorityQueue<T extends IComparable<T>> {
    private heap: T[] = [];

    size(): number {
        return this.heap.length;
    }

    isEmpty(): boolean {
        return this.size() === 0;
    }

    enqueue(item: T): void {
        this.heap.push(item);
        this.bubbleUp(this.size() - 1);
    }

    dequeue(): T | null {
        if (this.isEmpty()) return null;
        if (this.size() === 1) {
            return <T>this.heap.pop();
        }

        const root = this.heap[0];
        this.heap[0] = <T>this.heap.pop();
        this.sinkDown(0);

        return root;
    }

    peek(): T | undefined {
        return this.isEmpty() ? undefined : this.heap[0];
    }

    clear(): void {
        this.heap = [];
    }

    private bubbleUp(index: number): void {
        const parentIndex = Math.floor((index - 1) / 2);
        if (parentIndex >= 0 && this.compare(index, parentIndex) < 0) {
            this.swap(index, parentIndex);
            this.bubbleUp(parentIndex);
        }
    }

    private sinkDown(index: number): void {
        const leftChild = 2 * index + 1;
        const rightChild = 2 * index + 2;
        let smallest = index;

        if (leftChild < this.size() && this.compare(leftChild, smallest) < 0) {
            smallest = leftChild;
        }

        if (rightChild < this.size() && this.compare(rightChild, smallest) < 0) {
            smallest = rightChild;
        }

        if (smallest !== index) {
            this.swap(index, smallest);
            this.sinkDown(smallest);
        }
    }

    private compare(a: number, b: number): number {
        return this.heap[a].compareTo(this.heap[b]);
    }

    private swap(a: number, b: number): void {
        [this.heap[a], this.heap[b]] = [this.heap[b], this.heap[a]];
    }
}
