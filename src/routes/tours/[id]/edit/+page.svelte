<script lang="ts">
	import TourForm from '$lib/tours/TourForm.svelte';

	let { data, form } = $props();
</script>

<TourForm tour={data.tour} {form} action="?/update" />
