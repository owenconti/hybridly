import { debug } from '@hybridly/utils'
import type { ComponentOptions } from 'vue'
import { defineComponent, h, nextTick, toRaw } from 'vue'
import { dialogStore } from '../stores/dialog'
import { onMountedCallbacks } from '../stores/mount'
import { state } from '../stores/state'

export const wrapper = defineComponent({
	name: 'Hybridly',
	setup() {
		function renderLayout(view: any) {
			debug.adapter('vue:render:layout', 'Rendering layout.')

			if (typeof state.view.value?.layout === 'function') {
				return state.view.value.layout(h, view, renderDialog())
			}

			if (Array.isArray(state.view.value?.layout)) {
				const layoutsAndView = state.view
					.value!.layout.concat(view)
					.reverse()
					.reduce((child, layout) => {
						layout.inheritAttrs = !!layout.inheritAttrs

						return h(layout, {
							...(state.view.value?.properties ?? {}),
							...state.properties.value,
						}, () => child)
					})

				return [layoutsAndView, renderDialog()]
			}

			return [
				h(state.view.value?.layout, {
					...(state.view.value?.properties ?? {}),
					...state.properties.value,
				}, () => view),
				renderDialog(),
			]
		}

		// Overrides the `mounted` hook of the view component,
		// so we can pop the mounted callback from outside.
		function hijackOnMounted(component: ComponentOptions | undefined, type: 'view' | 'dialog') {
			if (!component) {
				return
			}

			const actual = component?.mounted
			component.mounted = () => {
				actual?.()
				nextTick(() => {
					debug.adapter(`vue:render:${type}`, 'Calling mounted callbacks.')

					while (onMountedCallbacks.length) {
						onMountedCallbacks.shift()?.()
					}
				})
			}
		}

		function renderView() {
			debug.adapter('vue:render:view', 'Rendering view.')
			state.view.value!.inheritAttrs = !!state.view.value!.inheritAttrs

			hijackOnMounted(state.view.value, 'view')

			return h(state.view.value!, {
				...state.properties.value,
				key: state.viewKey.value,
			})
		}

		function renderDialog() {
			if (dialogStore.state.component.value && dialogStore.state.properties.value) {
				debug.adapter('vue:render:dialog', 'Rendering dialog.')

				hijackOnMounted(dialogStore.state.component.value, 'dialog')

				return h(dialogStore.state.component.value!, {
					...dialogStore.state.properties.value,
					key: dialogStore.state.key.value,
				})
			}
		}

		return (...a) => {
			if (!state.view.value) {
				return
			}

			debug.adapter('vue:render:wrapper', 'Rendering wrapper component.', a.map(toRaw))

			const view = renderView()

			if (state.view.value.layout) {
				return renderLayout(view)
			}

			return [view, renderDialog()]
		}
	},
})
