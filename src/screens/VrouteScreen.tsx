import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Cpu, Plus, Server, Wifi } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { CustomerFeatureUnavailable } from "../components/CustomerFeatureUnavailable";
import { useAuth } from "../components/AuthProvider";
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useRouter } from '../components/Router';
import { useI18n } from '../i18n';
import { hideElizonPlusUi, showElizonPlusFeatures } from "../lib/elizon-plus";

const COLORS = ["#38bdf8", "#a78bfa", "#f472b6", "#34d399", "#facc15"];

const getColor = (index: number): string => COLORS[index % COLORS.length] ?? "#38bdf8";

type VrouteNetwork = {
  id: string;
  name: string;
  color: string;
  cidr: string;
  host: string;
};

type VrouteVm = {
  id: string;
  name: string;
  ip: string;
  networkId: string;
  cpu: number;
  memory: number;
};

export function VrouteScreen() {
  const { t } = useI18n();
  const { back, navigate } = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [networks, setNetworks] = useState<VrouteNetwork[]>([
    { id: "net-1", name: "Web VLAN", color: getColor(0), cidr: "10.0.1.0/24", host: "host-1" },
    { id: "net-2", name: "DB VLAN", color: getColor(1), cidr: "10.0.2.0/24", host: "host-2" },
  ]);
  const [vms, setVms] = useState<VrouteVm[]>([
    { id: "vm-1", name: "app-01", ip: "10.0.1.12", networkId: "net-1", cpu: 2, memory: 4 },
    { id: "vm-2", name: "db-01", ip: "10.0.2.11", networkId: "net-2", cpu: 4, memory: 8 },
  ]);
  const [newNetworkName, setNewNetworkName] = useState("");
  const [newNetworkCidr, setNewNetworkCidr] = useState("");
  const [newVmName, setNewVmName] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<VrouteNetwork | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (hideElizonPlusUi(user)) return;
    if (!showElizonPlusFeatures(user)) {
      navigate({ name: "dashboard" });
    }
  }, [authLoading, navigate, user]);

  const networkSummary = useMemo(() => ({
    totalNets: networks.length,
    totalVms: vms.length,
    totalCpu: vms.reduce((sum, vm) => sum + vm.cpu, 0),
  }), [networks, vms]);

  if (!authLoading && hideElizonPlusUi(user)) {
    return <CustomerFeatureUnavailable />;
  }

  if (!authLoading && !showElizonPlusFeatures(user)) {
    return null;
  }

  const addNetwork = () => {
    if (!newNetworkName.trim() || !newNetworkCidr.trim()) return;
    setNetworks((prev) => {
      const color = getColor(prev.length);
      return [
        ...prev,
        {
          id: `net-${Date.now()}`,
          name: newNetworkName.trim(),
          cidr: newNetworkCidr.trim(),
          color,
          host: `host-${prev.length + 1}`,
        },
      ];
    });
    setNewNetworkName("");
    setNewNetworkCidr("");
  };

  const addVm = () => {
    if (!selectedNetwork || !newVmName.trim()) return;
    const [baseIp = ""] = selectedNetwork.cidr.split("/");
    setVms((prev) => [
      ...prev,
      {
        id: `vm-${Date.now()}`,
        name: newVmName.trim(),
        ip: `${baseIp.replace(/\.\d+$/, ".")}2${prev.length + 2}`,
        networkId: selectedNetwork.id,
        cpu: 2,
        memory: 4,
      },
    ]);
    setNewVmName("");
  };

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">

      <main className="safe-x flex-1 space-y-4 pb-24 pt-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={back} aria-label={t("back")}> 
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <p className="text-xs uppercase tracking-wide text-(--text-muted)">{t("vrouteSectionOverview")}</p>
            <h2 className="text-base font-semibold text-(--text-primary)">{t("vrouteNetworkMap")}</h2>
          </div>
        </div>

        <section className="glass p-4">
          <div className="grid grid-cols-3 gap-3">
            <MiniStat icon={Wifi} label={t("vrouteNetworks")} value={`${networkSummary.totalNets}`} />
            <MiniStat icon={Server} label={t("vrouteVms")} value={`${networkSummary.totalVms}`} />
            <MiniStat icon={Cpu} label={t("vrouteCpu")} value={`${networkSummary.totalCpu} vCPU`} />
          </div>
        </section>

        <section className="glass p-4">
          <h3 className="text-sm font-semibold text-(--text-primary)">{t("vrouteNetworks")}</h3>
          <div className="mt-3 space-y-3">
            {networks.map((network) => (
              <button
                key={network.id}
                type="button"
                onClick={() => setSelectedNetwork(network)}
                className="glass glass-hover flex items-center justify-between gap-3 rounded-xl p-3 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-(--text-primary)">{network.name}</p>
                  <p className="text-[11px] text-(--text-muted)">{network.cidr} · {network.host}</p>
                </div>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: network.color }} />
              </button>
            ))}
          </div>
        </section>

        <section className="glass p-4 space-y-3">
          <h3 className="text-sm font-semibold text-(--text-primary)">{t("vrouteCreateNetwork")}</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-(--text-muted)">{t("vrouteNetworkName")}</Label>
              <Input value={newNetworkName} onChange={(e) => setNewNetworkName(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-(--text-muted)">{t("vrouteNetworkCidr")}</Label>
              <Input value={newNetworkCidr} onChange={(e) => setNewNetworkCidr(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <Button onClick={addNetwork} className="btn-primary w-full justify-center rounded-xl py-3" disabled={!newNetworkName.trim() || !newNetworkCidr.trim()}>
              <Plus className="size-4" />
              {t("vrouteAddNetwork")}
            </Button>
          </div>
        </section>

        {selectedNetwork ? (
          <section className="glass p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-(--text-primary)">{selectedNetwork.name}</p>
                <p className="text-[11px] text-(--text-muted)">{selectedNetwork.cidr}</p>
              </div>
              <span className="rounded-full bg-(--surface-soft) px-2 py-1 text-[11px] text-(--text-muted)">{t("vrouteSelected")}</span>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-xs text-(--text-muted)">{t("vrouteVmName")}</Label>
                <Input value={newVmName} onChange={(e) => setNewVmName(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <Button onClick={addVm} className="btn-primary w-full justify-center rounded-xl py-3" disabled={!newVmName.trim()}>
                {t("vrouteAddVm")}
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {vms.filter((vm) => vm.networkId === selectedNetwork.id).map((vm) => (
                <div key={vm.id} className="rounded-2xl border border-(--border) p-3">
                  <p className="text-sm font-semibold text-(--text-primary)">{vm.name}</p>
                  <p className="text-[11px] text-(--text-muted)">{vm.ip} · {vm.cpu} vCPU · {vm.memory} GB</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-(--surface-soft) p-4 text-center">
      <Icon className="mx-auto size-5 text-(--elizon-primary)" />
      <p className="mt-3 text-xs uppercase tracking-wide text-(--text-muted)">{label}</p>
      <p className="mt-2 text-lg font-semibold text-(--text-primary)">{value}</p>
    </div>
  );
}
