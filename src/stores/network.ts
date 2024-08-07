import type {
  NetworkResponse,
  WifiSpeedtestResponse,
} from "@/interfaces/NetworkResponse";
import type {
  NetworkTrafficMetric,
  WifiMetric,
} from "@/interfaces/types/NetworkTypes";
import { defineStore } from "pinia";
import { useLoadingStore } from "./loading";

export const useNetworkStore = defineStore("network", {
  state: () => ({
    data: <NetworkResponse>{},
    speed: <WifiSpeedtestResponse>{
      ping: "",
      download: <string | null>null,
      upload: <string | null>null,
    },
    speedtestInProgress: false,
  }),
  actions: {
    async get() {
      const loader = useLoadingStore();
      loader.setMessage("Retrieving network information...");

      this.http
        .get("network")
        .then(async (response) => {
          const { data }: { data: NetworkResponse } = response;
          this.updateNetwork(data);
          setTimeout(() => {
            loader.toggle(true);
          }, 1000);
        })
        .catch(() => {
          loader.setError("An unexpected error has occurred");
        });
    },
    async speedtest({ timeout = false }: { timeout: boolean }) {
      this.speedtestInProgress = true;

      const request = () => {
        const waiting = (metric: WifiMetric) => {
          let up = true;
          return setInterval(() => {
            if (up) {
              this.speed[metric] += ".";
            } else {
              this.speed[metric] = this.speed[metric].substring(
                1,
                this.speed[metric].length
              );
              if (this.speed[metric] === ".") {
                up = true;
              }
            }
            if (this.speed[metric].length > 6) {
              up = false;
            }
          }, 100);
        };

        const progress: {
          [key in WifiMetric]: ReturnType<typeof setInterval> | null;
        } = {
          ping: null,
          download: null,
          upload: null,
        };

        for (const key in this.speed) {
          const metric = <WifiMetric>key;
          progress[metric] = waiting(metric);
        }

        this.http.get("network/wifi/speed").then((response) => {
          const { data }: { data: WifiSpeedtestResponse } = response.data;
          for (const key in this.speed) {
            const metric = <WifiMetric>key;
            if (progress[metric]) {
              clearInterval(<ReturnType<typeof setInterval>>progress[metric]);
            }
            this.speed[metric] = data[metric];
          }

          this.speedtestInProgress = false;
        });
      };

      if (timeout) {
        setTimeout(() => request(), 5000);
      } else {
        request();
      }
    },
    updateNetwork(data: NetworkResponse) {
      this.$patch({ data });
    },
    updateSpeedTest(speed: WifiSpeedtestResponse) {
      this.$patch({ speed });
    },
    formatBarChartDataForNetwork(
      series: Array<number>,
      key: Array<NetworkTrafficMetric>
    ) {
      const response: Array<{ name: string; data: Array<number> }> = [];
      series.forEach((point, idx) => {
        response.push({
          name: key[idx],
          data: [(<unknown>point) as number],
        });
      });
      return response;
    },
  },
});
