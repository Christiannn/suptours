<script lang="ts">
	import TourForm from '$lib/tours/TourForm.svelte';

	let { form } = $props();
</script>

<TourForm {form} />
