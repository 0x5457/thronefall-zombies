// React root for all in-game UI. The campaign actor stays the navigation authority;
// the snapshot store carries per-tick game data.
import { createRoot } from 'react-dom/client';
import { useSelector } from '@xstate/react';
import { overlayValue } from '../machine.js';
import type { startCampaign } from '../machine.js';
import { BuildingPanel } from './BuildingPanel.js';
import { EndDialog, HelpDialog, NightConfirmDialog, PerkDialog } from './Dialogs.js';
import { Hud } from './Hud.js';
import { ManualDialog } from './Manual.js';
import { RvPanel } from './RvPanel.js';

type CampaignActor = ReturnType<typeof startCampaign>;

export function UiApp({ actor }: { actor: CampaignActor }) {
  const overlay = useSelector(actor, (snapshot) => overlayValue(snapshot));
  return (
    <>
      <Hud />
      <BuildingPanel />
      <RvPanel />
      <HelpDialog open={overlay === 'help'} />
      <ManualDialog open={overlay === 'manual'} />
      <NightConfirmDialog open={overlay === 'confirm'} />
      <PerkDialog />
      <EndDialog />
    </>
  );
}

export function mountUi(actor: CampaignActor): void {
  const host = document.createElement('div');
  host.id = 'ui-root';
  host.style.display = 'contents';
  document.getElementById('app')!.append(host);
  createRoot(host).render(<UiApp actor={actor} />);
}
