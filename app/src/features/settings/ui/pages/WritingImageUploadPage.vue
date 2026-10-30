<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();
</script>

<template>
  <!-- image upload (external image hosting) — like Typora / MarkText.
       Instead of (or alongside) copying a pasted image locally, upload it
       to an image host and insert the returned URL. -->
  <section data-cat="writing" data-page="writing/image-upload">
    <label>{{ t('settings.imageUploaderSection') }}</label>
    <select
      :value="settings.imageUploader"
      @change="settings.setImageUpload({ imageUploader: ($event.target as HTMLSelectElement).value as 'none' | 'picgo' | 'command' | 'smms' | 's3' | 'github' })"
    >
      <option value="none">{{ t('settings.imageUploaderNone') }}</option>
      <option value="picgo">{{ t('settings.imageUploaderPicgo') }}</option>
      <option value="command">{{ t('settings.imageUploaderCommand') }}</option>
      <option value="smms">{{ t('settings.imageUploaderSmms') }}</option>
      <option value="s3">{{ t('settings.imageUploaderS3') }}</option>
      <option value="github">{{ t('settings.imageUploaderGithub') }}</option>
    </select>
  </section>

  <template v-if="settings.imageUploader !== 'none'">
    <section data-cat="writing" data-page="writing/image-upload">
      <label>
        <input
          type="checkbox"
          :checked="settings.imageUploadOnPaste"
          @change="settings.setImageUpload({ imageUploadOnPaste: ($event.target as HTMLInputElement).checked })"
        />
        {{ t('settings.imageUploadOnPaste') }}
      </label>
      <p class="setting-hint">{{ t('settings.imageUploadOnPasteHint') }}</p>
    </section>
    <section data-cat="writing" data-page="writing/image-upload">
      <label>
        <input
          type="checkbox"
          :checked="settings.imageUploadKeepLocal"
          @change="settings.setImageUpload({ imageUploadKeepLocal: ($event.target as HTMLInputElement).checked })"
        />
        {{ t('settings.imageUploadKeepLocal') }}
      </label>
      <p class="setting-hint">{{ t('settings.imageUploadKeepLocalHint') }}</p>
    </section>

    <!-- PicGo -->
    <section data-cat="writing" data-page="writing/image-upload" v-if="settings.imageUploader === 'picgo'">
      <label>{{ t('settings.picgoEndpoint') }}</label>
      <input
        class="img-field"
        type="text"
        :value="settings.picgoEndpoint"
        @change="settings.setImageUpload({ picgoEndpoint: ($event.target as HTMLInputElement).value })"
        placeholder="http://127.0.0.1:36677/upload"
      />
      <p class="setting-hint">{{ t('settings.picgoEndpointHint') }}</p>
    </section>

    <!-- Custom command -->
    <section data-cat="writing" data-page="writing/image-upload" v-if="settings.imageUploader === 'command'">
      <label>{{ t('settings.imageUploadCommand') }}</label>
      <input
        class="img-field"
        type="text"
        :value="settings.imageUploadCommand"
        @change="settings.setImageUpload({ imageUploadCommand: ($event.target as HTMLInputElement).value })"
        placeholder="picgo upload {path}"
      />
      <p class="setting-hint">{{ t('settings.imageUploadCommandHint') }}</p>
    </section>

    <!-- SM.MS -->
    <section data-cat="writing" data-page="writing/image-upload" v-if="settings.imageUploader === 'smms'">
      <label>{{ t('settings.smmsToken') }}</label>
      <input
        class="img-field"
        type="password"
        :value="settings.smmsToken"
        @change="settings.setImageUpload({ smmsToken: ($event.target as HTMLInputElement).value })"
      />
      <p class="setting-hint">{{ t('settings.smmsTokenHint') }}</p>
    </section>

    <!-- S3-compatible -->
    <template v-if="settings.imageUploader === 's3'">
      <section data-cat="writing" data-page="writing/image-upload">
        <label>{{ t('settings.s3Endpoint') }}</label>
        <input class="img-field" type="text" :value="settings.s3Endpoint" @change="settings.setImageUpload({ s3Endpoint: ($event.target as HTMLInputElement).value })" placeholder="https://s3.amazonaws.com" />
      </section>
      <section data-cat="writing" data-page="writing/image-upload">
        <label>{{ t('settings.s3Region') }}</label>
        <input class="img-field" type="text" :value="settings.s3Region" @change="settings.setImageUpload({ s3Region: ($event.target as HTMLInputElement).value })" placeholder="us-east-1" />
      </section>
      <section data-cat="writing" data-page="writing/image-upload">
        <label>{{ t('settings.s3Bucket') }}</label>
        <input class="img-field" type="text" :value="settings.s3Bucket" @change="settings.setImageUpload({ s3Bucket: ($event.target as HTMLInputElement).value })" />
      </section>
      <section data-cat="writing" data-page="writing/image-upload">
        <label>{{ t('settings.s3AccessKeyId') }}</label>
        <input class="img-field" type="text" :value="settings.s3AccessKeyId" @change="settings.setImageUpload({ s3AccessKeyId: ($event.target as HTMLInputElement).value })" />
      </section>
      <section data-cat="writing" data-page="writing/image-upload">
        <label>{{ t('settings.s3SecretAccessKey') }}</label>
        <input class="img-field" type="password" :value="settings.s3SecretAccessKey" @change="settings.setImageUpload({ s3SecretAccessKey: ($event.target as HTMLInputElement).value })" />
      </section>
      <section data-cat="writing" data-page="writing/image-upload">
        <label>{{ t('settings.s3PathPrefix') }}</label>
        <input class="img-field" type="text" :value="settings.s3PathPrefix" @change="settings.setImageUpload({ s3PathPrefix: ($event.target as HTMLInputElement).value })" placeholder="images/" />
      </section>
      <section data-cat="writing" data-page="writing/image-upload">
        <label>{{ t('settings.s3CustomDomain') }}</label>
        <input class="img-field" type="text" :value="settings.s3CustomDomain" @change="settings.setImageUpload({ s3CustomDomain: ($event.target as HTMLInputElement).value })" placeholder="https://cdn.example.com" />
      </section>
      <section data-cat="writing" data-page="writing/image-upload">
        <label>
          <input type="checkbox" :checked="settings.s3UsePathStyle" @change="settings.setImageUpload({ s3UsePathStyle: ($event.target as HTMLInputElement).checked })" />
          {{ t('settings.s3UsePathStyle') }}
        </label>
      </section>
    </template>

    <!-- GitHub repo + CDN -->
    <template v-if="settings.imageUploader === 'github'">
      <section data-cat="writing" data-page="writing/image-upload">
        <label>{{ t('settings.ghImageRepo') }}</label>
        <input class="img-field" type="text" :value="settings.ghImageRepo" @change="settings.setImageUpload({ ghImageRepo: ($event.target as HTMLInputElement).value })" placeholder="owner/repo" />
      </section>
      <section data-cat="writing" data-page="writing/image-upload">
        <label>{{ t('settings.ghImageBranch') }}</label>
        <input class="img-field" type="text" :value="settings.ghImageBranch" @change="settings.setImageUpload({ ghImageBranch: ($event.target as HTMLInputElement).value })" placeholder="main" />
      </section>
      <section data-cat="writing" data-page="writing/image-upload">
        <label>{{ t('settings.ghImageToken') }}</label>
        <input class="img-field" type="password" :value="settings.ghImageToken" @change="settings.setImageUpload({ ghImageToken: ($event.target as HTMLInputElement).value })" />
      </section>
      <section data-cat="writing" data-page="writing/image-upload">
        <label>{{ t('settings.ghImagePathPrefix') }}</label>
        <input class="img-field" type="text" :value="settings.ghImagePathPrefix" @change="settings.setImageUpload({ ghImagePathPrefix: ($event.target as HTMLInputElement).value })" placeholder="images/" />
      </section>
      <section data-cat="writing" data-page="writing/image-upload">
        <label>{{ t('settings.ghImageCdn') }}</label>
        <select
          :value="settings.ghImageCdn"
          @change="settings.setImageUpload({ ghImageCdn: ($event.target as HTMLSelectElement).value as 'raw' | 'jsdelivr' })"
        >
          <option value="jsdelivr">{{ t('settings.ghImageCdnJsdelivr') }}</option>
          <option value="raw">{{ t('settings.ghImageCdnRaw') }}</option>
        </select>
      </section>
    </template>
  </template>
</template>

<style scoped src="../settings-page.css"></style>
