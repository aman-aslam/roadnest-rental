declare global {
  interface Window {
    Razorpay?: new (options: any) => { open: () => void; on: (event: string, cb: (response: any) => void) => void };
  }
}
export {};
