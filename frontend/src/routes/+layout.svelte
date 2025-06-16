<script lang="ts">
	import '../app.css';
	import type { LayoutData } from './$types';

	export let data: LayoutData;
</script>

{#if !data.user}
	<!-- Splash page for unauthenticated users -->
	<div class="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
		<div class="bg-white p-8 rounded-lg shadow-xl max-w-md w-full mx-4 text-center">
			<h1 class="text-3xl font-bold text-gray-800 mb-4">Welcome to AI Photo Album</h1>
			<p class="text-gray-600 mb-8">
				Sign in to start organizing and searching your photos with AI
			</p>
			<a
				href="/auth/login"
				class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
			>
				<svg class="w-5 h-5 mr-2" viewBox="0 0 24 24">
					<path
						fill="currentColor"
						d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
					/>
				</svg>
				Sign in with Google
			</a>
		</div>
	</div>
{:else}
	<!-- Main app layout for authenticated users -->
	<div class="min-h-screen bg-gray-100">
		<nav class="bg-white shadow-sm">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex justify-between h-16">
					<div class="flex items-center">
						<a href="/" class="text-xl font-bold text-gray-800">AI Photo Album</a>
					</div>
					<div class="flex items-center">
						<div class="flex items-center space-x-4">
							<img
								src={data.user.picture}
								alt={data.user.name}
								class="h-8 w-8 rounded-full"
							/>
							<span class="text-gray-700">{data.user.name}</span>
							<form action="/auth/logout" method="POST">
								<button
									type="submit"
									class="text-sm text-gray-600 hover:text-gray-900"
								>
									Sign out
								</button>
							</form>
						</div>
					</div>
				</div>
			</div>
		</nav>

		<main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
			<slot />
		</main>
	</div>
{/if}
