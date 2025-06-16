<script lang="ts">
  import type { PageData } from './$types';
  import { fade } from 'svelte/transition';
  import { onMount } from 'svelte';

  export let data: PageData;

  // Placeholder data for the photo grid
  const placeholderPhotos = Array.from({ length: 20 }, (_, i) => ({
    id: `photo-${i}`,
    url: `https://picsum.photos/seed/${i}/800/600`,
    description: `Placeholder photo ${i + 1}`,
    uploadDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
    status: 'completed' as const
  }));

  // State for filtering and search
  let searchQuery = '';
  let sortBy: 'newest' | 'oldest' = 'newest';
  let statusFilter: 'all' | 'pending' | 'processing' | 'completed' = 'all';

  // Computed filtered photos
  $: filteredPhotos = placeholderPhotos
    .filter(photo => {
      if (statusFilter !== 'all' && photo.status !== statusFilter) return false;
      if (searchQuery && !photo.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return b.uploadDate.getTime() - a.uploadDate.getTime();
      return a.uploadDate.getTime() - b.uploadDate.getTime();
    });

  // Format date helper
  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  onMount(async () => {
    if (data.user) {
      try {
        const res = await fetch('/api/auth/user');
        const result = await res.json();
        console.log('Backend /api/auth/user result:', result);
      } catch (err) {
        console.error('Error calling backend /api/auth/user:', err);
      }
    }
  });
</script>

<div class="container mx-auto px-4 py-8">
  <!-- Header with upload button and filters -->
  <div class="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <div class="flex-1">
      <h1 class="text-2xl font-bold text-gray-900">My Photos</h1>
      <p class="text-gray-600">Browse and search your AI-powered photo collection</p>
    </div>
    <button
      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
    >
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      Upload Photos
    </button>
  </div>

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
    {#each filteredPhotos as photo (photo.id)}
      <div
        transition:fade
        class="group relative bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
      >
        <!-- Photo -->
        <div class="aspect-w-4 aspect-h-3 bg-gray-100">
          <img
            src={photo.url}
            alt={photo.description}
            class="object-cover w-full h-full"
            loading="lazy"
          />
        </div>

        <!-- Overlay with description -->
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          <div class="absolute bottom-0 left-0 right-0 p-4 text-white">
            <p class="text-sm font-medium truncate">{photo.description}</p>
            <p class="text-xs text-gray-200 mt-1">{formatDate(photo.uploadDate)}</p>
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
  </div>

  <!-- Empty state -->
  {#if filteredPhotos.length === 0}
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
