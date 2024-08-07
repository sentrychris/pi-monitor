import type {
  SystemResponse,
  RealtimeSystemResponse,
} from "@/interfaces/SystemResponse";
import type { ProcessInformation } from "@/interfaces/SystemInformation";
import type { ProcessMetric } from "@/interfaces/types/SystemTypes";
import { defineStore } from "pinia";
import { useLoadingStore } from "./loading";
import { config } from "@/config";

export const useSystemStore = defineStore("system", {
  state: () => ({
    data: <SystemResponse>{},
    realtime: <RealtimeSystemResponse>{
      cpu: {
        freq: 0,
        temp: 0,
        usage: 0,
      },
      mem: {
        total: 0,
        used: 0,
        free: 0,
        percent: 0,
      },
      disk: {
        total: 0,
        used: 0,
        free: 0,
        percent: 0,
      },
      uptime: null,
      processes: [],
    },
    connection: <WebSocket | null>null,
    type: <string | null>null,
    live: false,
    connected: false,
    poll: <any>null,
  }),
  actions: {
    async connect({
      websocket = false,
      refresh = false,
    }: {
      websocket: boolean;
      refresh?: boolean;
    }) {
      this.type = websocket ? "websocket" : "http";
      if (!this.connected) {
        const loader = useLoadingStore();

        if (!refresh) {
          loader.toggle(false);
          loader.setMessage("Connecting to system monitor...");
        }

        this.http
          .get("system")
          .then((response) => {
            const { data }: { data: SystemResponse } = response;
            this.staticUpdate(data);
            this.connected = true;
            if (websocket) {
              this.websocket();
            } else if (!refresh) {
              loader.toggle(true);
            }
          })
          .catch(() => {
            if (!refresh) {
              loader.setError("An unexpected error has occurred");
            }
          });
      }
    },
    async websocket() {
      const loader = useLoadingStore();
      loader.setMessage("Opening websocket connection...");

      const response = await fetch(config.api.urls.worker, {
        method: "POST",
        body: JSON.stringify({ connection: "monitor" }),
      });

      const worker = await response.json();

      const url = `${config.api.urls.websocket}?id=${worker.id}`;

      this.connection = this.connection ?? new WebSocket(url);

      this.connection.onopen = () => {
        loader.setMessage("Websocket connected, loading dashboard...");
        setTimeout(() => {
          loader.toggle(true);
          this.live = true;
        }, 1000);
      };
      this.connection.onerror = () => {
        loader.toggle(false);
        loader.setMessage("Error! Unable to connect to websocket...");
      };
      this.connection.onmessage = (response) => {
        try {
          const data = JSON.parse(response.data) as RealtimeSystemResponse;
          this.liveUpdate(data);
        } catch (error) {
          console.log({ error });
        }
      };
      this.connection.onclose = () => {
        this.live = false;
        this.connection = null;
        console.log("websocket connection closed");
      };
    },
    async startPollingApi(interval: number = 30000) {
      if (!this.poll) {
        this.poll = setInterval(() => {
          this.refresh(false);
        }, interval);
      }
    },
    async stopPollingApi() {
      if (this.poll) {
        clearInterval(this.poll);
      }
      this.poll = null;
    },
    async toggle() {
      const type = this.type === "websocket" ? "http" : "websocket";
      this.setConnectionType(type);
      this.refresh(this.type === "websocket");
    },
    async refresh(websocket: boolean) {
      if (this.connection instanceof WebSocket) {
        this.connection.close();
      }

      this.connected = false;
      this.connect({ websocket, refresh: true });
    },
    async reconnect() {
      if (this.connection instanceof WebSocket) {
        this.connection.close();
        this.connect({ websocket: true });
      }
    },
    staticUpdate(data: SystemResponse) {
      this.$patch({ data });
    },
    liveUpdate(realtime: RealtimeSystemResponse) {
      this.$patch({ realtime });
      this.realtime.processes = realtime.processes;
    },
    setConnectionType(type: string) {
      this.type = type;
    },
    formatBarChartDataForSystem(
      series: Array<ProcessInformation>,
      key: ProcessMetric
    ) {
      const response: Array<{ name: string; data: Array<number> }> = [];

      series.forEach((point) => {
        const dp = response.find((dp) => {
          return dp.name === point.name;
        });

        if (dp) {
          dp.data[0] += point.mem;
        } else {
          response.push({
            name: point.name,
            data: [(<unknown>point[key]) as number],
          });
        }
      });

      return response;
    },
    formatPieChartDataForProcesses(
      series: Array<ProcessInformation>
    ) {
      const response: Array<{ name: string; y: number }> = [];
      series.forEach((point) => {
        const dp = response.find((dp) => {
          return dp.name === point.name;
        });
    
        if (dp) {
          dp.y += point.mem;
        } else {
          response.push({
            name: point.name,
            y: (<unknown>point.mem) as number,
          });
        }
      });
    
      return response;
    }
  },
  persist: {
    storage: localStorage,
    paths: ["type"],
  },
});
