<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount } from 'svelte';
  import {
    listPhotos,
    uploadPhoto,
    getPhotoUrl,
    getPhotoStatus,
    validateImageFile,
    deletePhoto,
    type PhotoMetadata
  } from '$lib/api/photos';

  export let data: any;

  let photos: PhotoMetadata[] = [];
  let loading = false;
  let error: string | null = null;
  let uploading = false;
  let uploadError: string | null = null;
  let uploadInput: HTMLInputElement | null = null;
  let deleting = false;

  // State for filtering and search
  let searchQuery = '';
  let sortBy: 'newest' | 'oldest' = 'newest';
  let statusFilter: 'all' | 'pending' | 'processing' | 'completed' = 'all';

  // Gallery modal state
  let showModal = false;
  let modalPhoto: PhotoMetadata | null = null;
  let modalPhotoUrl: string | null = null;

  // Fetch photos from backend
  async function fetchPhotos() {
    loading = true;
    error = null;
    try {
      const res = await listPhotos();
      photos = await Promise.all(res.photos.map(async (photo) => {
        if (photo.lookupKey) {
          try {
            const urlRes = await getPhotoUrl(photo.lookupKey);
            return { ...photo, presignedUrl: urlRes.presignedUrl };
          } catch {
            return photo;
          }
        }
        return photo;
      }));
    } catch (e: any) {
      error = e.message || 'Failed to load photos';
    } finally {
      loading = false;
    }
  }

  // Poll for processing photos
  let pollInterval: any = null;
  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      const processing = photos.filter(p => p.status === 'pending' || p.status === 'processing');
      if (processing.length === 0) return;
      for (const photo of processing) {
        if (photo.lookupKey) {
          try {
            const status = await getPhotoStatus(photo.lookupKey);
            if (status.status !== photo.status || status.title !== photo.title || status.description !== photo.description) {
              await fetchPhotos();
              break;
            }
          } catch {}
        }
      }
    }, 4000);
  }

  // Computed filtered photos
  $: filteredPhotos = photos
    .filter(photo => {
      if (statusFilter !== 'all' && photo.status !== statusFilter) return false;
      if (searchQuery && !(photo.title || photo.description || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const aDate = new Date(a.uploadTimestamp).getTime();
      const bDate = new Date(b.uploadTimestamp).getTime();
      if (sortBy === 'newest') return bDate - aDate;
      return aDate - bDate;
    });

  // Format date helper
  function formatDate(dateStr: string): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateStr));
  }

  // Handle file upload
  async function handleUpload(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const validation = validateImageFile(file);
    if (!validation.valid) {
      uploadError = validation.error || 'Invalid file';
      return;
    }
    uploading = true;
    uploadError = null;
    try {
      await uploadPhoto(file);
      await fetchPhotos();
      startPolling();
      if (uploadInput) uploadInput.value = '';
    } catch (e: any) {
      uploadError = e.message || 'Upload failed';
    } finally {
      uploading = false;
    }
  }

  // Open gallery modal
  async function openModal(photo: PhotoMetadata) {
    modalPhoto = photo;
    modalPhotoUrl = photo.presignedUrl || null;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    modalPhoto = null;
    modalPhotoUrl = null;
  }

  // Handle photo deletion
  async function handleDelete() {
    if (!modalPhoto?.lookupKey) return;
    
    deleting = true;
    try {
      await deletePhoto(modalPhoto.lookupKey);
      // Remove the photo from the local list
      photos = photos.filter(p => p.photoId !== modalPhoto?.photoId);
      closeModal();
    } catch (e: any) {
      error = e.message || 'Failed to delete photo';
    } finally {
      deleting = false;
    }
  }

  onMount(async () => {
    await fetchPhotos();
    startPolling();
  });
</script>

<div class="container mx-auto px-4 py-8">
  <!-- Header with upload button and filters -->
  <div class="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <div class="flex-1">
      <h1 class="text-2xl font-bold text-gray-900">My Photos</h1>
      <p class="text-gray-600">Browse and search your AI-powered photo collection</p>
    </div>
    <label class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      {uploading ? 'Uploading...' : 'Upload Photo'}
      <input
        type="file"
        accept="image/*"
        class="hidden"
        bind:this={uploadInput}
        on:change={handleUpload}
        disabled={uploading}
      />
    </label>
  </div>
  {#if uploadError}
    <div class="mb-4 text-red-600">{uploadError}</div>
  {/if}

  <!-- Search and filter controls -->
  <div class="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div class="relative">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search photos..."
        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
      />
      <svg
        class="absolute right-3 top-2.5 h-5 w-5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>

    <select
      bind:value={sortBy}
      class="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
    >
      <option value="newest">Newest First</option>
      <option value="oldest">Oldest First</option>
    </select>

    <select
      bind:value={statusFilter}
      class="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
    >
      <option value="all">All Photos</option>
      <option value="pending">Pending</option>
      <option value="processing">Processing</option>
      <option value="completed">Completed</option>
    </select>
  </div>

  <!-- Photo grid -->
  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
    {#if loading}
      <div class="col-span-full text-center text-gray-500">Loading photos...</div>
    {:else if error}
      <div class="col-span-full text-center text-red-600">{error}</div>
    {:else}
      {#each filteredPhotos as photo (photo.photoId)}
        <div
          transition:fade
          class="group relative bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 cursor-pointer"
          on:click={() => openModal(photo)}
        >
          <!-- Photo -->
          <div class="aspect-w-4 aspect-h-3 bg-gray-100">
            {#if photo.presignedUrl}
              <img
                src={photo.presignedUrl}
                alt={photo.title || photo.description || 'Photo'}
                class="object-cover w-full h-full"
                loading="lazy"
              />
            {:else}
              <div class="flex items-center justify-center w-full h-full text-gray-400">No Image</div>
            {/if}
          </div>

          <!-- Overlay with description -->
          <div
            class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <div class="absolute bottom-0 left-0 right-0 p-4 text-white">
              <p class="text-sm font-medium truncate">{photo.title || photo.description || 'No title'}</p>
              <p class="text-xs text-gray-200 mt-1">{formatDate(photo.uploadTimestamp)}</p>
            </div>
          </div>

          <!-- Status badge -->
          {#if photo.status !== 'completed'}
            <div
              class="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full
                {photo.status === 'pending'
                  ? 'bg-yellow-100 text-yellow-800'
                  : photo.status === 'processing'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-green-100 text-green-800'}"
            >
              {photo.status.charAt(0).toUpperCase() + photo.status.slice(1)}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <!-- Empty state -->
  {#if !loading && !error && filteredPhotos.length === 0}
    <div class="text-center py-12">
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No photos found</h3>
      <p class="mt-1 text-sm text-gray-500">
        {searchQuery
          ? 'Try adjusting your search or filters'
          : 'Get started by uploading some photos'}
      </p>
    </div>
  {/if}

  <!-- Gallery Modal -->
  {#if showModal && modalPhoto}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" on:click={closeModal}>
      <div class="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 relative" on:click|stopPropagation>
        <div class="flex justify-between items-start mb-4">
          <h2 class="text-lg font-bold">{modalPhoto.title || 'No title'}</h2>
          <div class="flex gap-2">
            <button 
              class="text-red-600 hover:text-red-800 p-1 rounded"
              on:click={handleDelete}
              disabled={deleting}
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button class="text-gray-500 hover:text-gray-700" on:click={closeModal}>&times;</button>
          </div>
        </div>
        {#if modalPhotoUrl}
          <img src={modalPhotoUrl} alt={modalPhoto.title || 'Photo'} class="w-full rounded mb-4" />
        {/if}
        <p class="text-gray-700 mb-2">{modalPhoto.description || 'No description'}</p>
        <p class="text-xs text-gray-500">Uploaded: {formatDate(modalPhoto.uploadTimestamp)}</p>
        {#if modalPhoto.processingError}
          <p class="text-xs text-red-600 mt-2">Error: {modalPhoto.processingError}</p>
        {/if}
        {#if deleting}
          <div class="mt-4 text-center text-gray-500">Deleting...</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  /* Ensure proper aspect ratio for photos */
  .aspect-w-4 {
    position: relative;
    padding-bottom: 75%; /* 4:3 aspect ratio */
  }
  .aspect-w-4 > * {
    position: absolute;
    height: 100%;
    width: 100%;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
  }
</style>
