import { reactive } from 'vue';

export interface GithubSyncDrafts {
  tokenInput: string;
  tokenSaving: boolean;
  newRepoName: string;
  newRepoPrivate: boolean;
  creatingRepo: boolean;
  linking: boolean;
  showAdvanced: boolean;
  manualCloneUrl: string;
  enableE2ee: boolean;
  giteaCloneUrl: string;
  passphraseInput: string;
  passphraseSaving: boolean;
  decrypting: boolean;
  giteaUrlValidating: boolean;
  giteaTokenInput: string;
  giteaTokenSaving: boolean;
  giteaRepoName: string;
  giteaRepoPrivate: boolean;
  giteaCreatingRepo: boolean;
  giteaLinking: boolean;
  commitMsg: string;
  upgradePassphrase: string;
  upgradeConfirm: string;
  upgradeAcknowledged: boolean;
  upgrading: boolean;
  upgradeOpen: boolean;
}

/** Form/draft state owned by GithubSyncSettings so it survives state-card switches, as before the split. */
export function createGithubSyncDrafts(): GithubSyncDrafts {
  return reactive<GithubSyncDrafts>({
    tokenInput: '',
    tokenSaving: false,
    newRepoName: '',
    newRepoPrivate: true,
    creatingRepo: false,
    linking: false,
    showAdvanced: false,
    manualCloneUrl: '',
    enableE2ee: false,
    giteaCloneUrl: '',
    passphraseInput: '',
    passphraseSaving: false,
    decrypting: false,
    giteaUrlValidating: false,
    giteaTokenInput: '',
    giteaTokenSaving: false,
    giteaRepoName: '',
    giteaRepoPrivate: true,
    giteaCreatingRepo: false,
    giteaLinking: false,
    commitMsg: '',
    upgradePassphrase: '',
    upgradeConfirm: '',
    upgradeAcknowledged: false,
    upgrading: false,
    upgradeOpen: false,
  });
}
