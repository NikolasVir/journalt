# Changelog

## [1.3.1](https://github.com/NikolasVir/journalt/compare/v1.3.0...v1.3.1) (2026-10-18)


### Bug Fixes

* **api:** add checklist patch and session cleanup ([8ae5c84](https://github.com/NikolasVir/journalt/commit/8ae5c84ef9a87ea19b50b46cdfdeca46b3be3df6))
* **client:** auto-save and sync checklist edits ([1716f9b](https://github.com/NikolasVir/journalt/commit/1716f9b6c9c7ea82d51972d7bf1abff93223fa8c))

## [1.3.0](https://github.com/NikolasVir/journalt/compare/v1.2.0...v1.3.0) (2026-10-13)


### Features

* **account:** load and save per-user accent ([a2634bb](https://github.com/NikolasVir/journalt/commit/a2634bb8bbd16c983c2d9967ab0e16abba04c206))
* **client:** add global link handler service ([e85fa72](https://github.com/NikolasVir/journalt/commit/e85fa72c21b0b3f135f9d8aab1f3e236b3b48019))
* **client:** add jt brand favicon assets ([5e6a068](https://github.com/NikolasVir/journalt/commit/5e6a06865af637a078ba5d6c83c45ad10540bc24))
* **client:** normalize external links on render ([0a79c0e](https://github.com/NikolasVir/journalt/commit/0a79c0e90ec1ce679f1f02d12d8554b8cb4d9d70))
* **client:** render markdown task checkboxes ([6e9e337](https://github.com/NikolasVir/journalt/commit/6e9e337a48a6e802f1642d033391718e77d0e424))
* **client:** tint favicon with the accent ([412c52b](https://github.com/NikolasVir/journalt/commit/412c52b21897e8f39ebdc5db08c408e185826d37))
* **settings:** add accent colour picker wheel ([bb01e6a](https://github.com/NikolasVir/journalt/commit/bb01e6aca3761f3f3f636c8a4d3d58e27b17f44c))
* **theme:** add user-selectable accent tokens ([6843dac](https://github.com/NikolasVir/journalt/commit/6843dac6acb86e688f8f4a93b27f4aaf2186fd27))
* **users:** store per-user accent colour ([f96814a](https://github.com/NikolasVir/journalt/commit/f96814a11d7d3baf4a2892c2fbc4a7492bd764ec))
* **vault:** add api to delete a vault ([31a717e](https://github.com/NikolasVir/journalt/commit/31a717e2ef1de5008c648ac60a8bfbae7e0d6683))
* **vault:** auto-create, seed, discard vaults ([32b8bf0](https://github.com/NikolasVir/journalt/commit/32b8bf0ef9074bca7ab1573b33324a00d3d65709))


### Bug Fixes

* **client:** dedupe header search affordances ([692f890](https://github.com/NikolasVir/journalt/commit/692f8908e5ffa74de16e797f50882f40d4a31c11))
* **client:** fit small-screen controls and taps ([0d15025](https://github.com/NikolasVir/journalt/commit/0d15025f5d4cf3bb6ad27078143b64db647fd9e3))
* **client:** inherit app font in form controls ([b67954d](https://github.com/NikolasVir/journalt/commit/b67954d404e0ff2411985953d09068701841328b))
* **client:** keep vault internal links same-tab ([39435f6](https://github.com/NikolasVir/journalt/commit/39435f6b2fe75bb8a907e78d27583a4716741216))
* **client:** raise vault subtitle contrast ([a9a63c8](https://github.com/NikolasVir/journalt/commit/a9a63c846cfa705846dc8fed12b3e496aaba8e8c))
* **sidebar:** follow accent on active nav item ([199e46a](https://github.com/NikolasVir/journalt/commit/199e46a232c38478d8381e9f7b29ccb18008ee0f))

## [1.2.0](https://github.com/NikolasVir/journalt/compare/v1.1.0...v1.2.0) (2026-10-12)


### Features

* **client:** add vault crypto and service ([80fe9bb](https://github.com/NikolasVir/journalt/commit/80fe9bbeaee3a648aa6cec9879803dec6fa2d694))
* **dashboard:** rework home and add note pinning ([742f572](https://github.com/NikolasVir/journalt/commit/742f5724e858fb578029a830b7dc04228c92ec73))
* library and subfolder sharing ([e280dcf](https://github.com/NikolasVir/journalt/commit/e280dcf62175b04e5ff4af7ef7ba401624426ab4))
* **notes:** show pin always, wire toggle ([91168a3](https://github.com/NikolasVir/journalt/commit/91168a310d2124594d6db69afa8ee19d524ae8b6))
* **server:** add vault api, service, dtos ([53c06ae](https://github.com/NikolasVir/journalt/commit/53c06ae9da9c85431ca86a7fd8930586ac514f20))
* **server:** add vault entities, migration ([8b4c0ee](https://github.com/NikolasVir/journalt/commit/8b4c0ee273236b90ff273523f612d35c09ad0480))
* **vault:** add encrypted notes page ([30912a6](https://github.com/NikolasVir/journalt/commit/30912a6a6ba344b7b22f592bb0c7ffda064912ca))

## [1.1.0](https://github.com/NikolasVir/journalt/compare/v1.0.1...v1.1.0) (2026-10-11)


### Features

* **client:** redesign todos page with search ([60ca304](https://github.com/NikolasVir/journalt/commit/60ca3048cd377237140643e1f27608f3e72f72bd))
* **client:** rename journal tab to journals ([71259ec](https://github.com/NikolasVir/journalt/commit/71259ecc8c64d0d9ed28f373d36397af119b4eef))
* **libraries:** add delete api with notes guard ([df05035](https://github.com/NikolasVir/journalt/commit/df05035e61276dece0d063c68f2ae4893a2d8e26))
* **libraries:** add in-place ux and delete guard ([498bfc2](https://github.com/NikolasVir/journalt/commit/498bfc22e9e6d15c1b67b8c70e6b813e7d5718c5))
* **libraries:** add library notes showcase view ([23d6738](https://github.com/NikolasVir/journalt/commit/23d6738d8e1e9b7cd648d80af6a83406df78e1d2))
* **notes:** add level filter to consolidated tab ([73143b4](https://github.com/NikolasVir/journalt/commit/73143b4bdd7125ee886cf009123e72374f17bb80))
* **settings:** refactor into tabbed navigation ([7cae7ce](https://github.com/NikolasVir/journalt/commit/7cae7cee59c98a22144a78322efc6eec46a0c0fa))
* **sidebar:** add collapsible library hierarchy ([ef2afb7](https://github.com/NikolasVir/journalt/commit/ef2afb7f92b5f709df7c5e0bb7d2d7e18789a754))
* **sidebar:** consolidate notes and journals nav ([b0f43e2](https://github.com/NikolasVir/journalt/commit/b0f43e2d7a99ca62a96200e6d3aa61df99071c1b))


### Bug Fixes

* **server:** rank exact title matches first ([31969dd](https://github.com/NikolasVir/journalt/commit/31969ddafdee7a98dd9ee77a39c346bbded2a7ec))
* **sidebar:** prevent scrollbar layout shift ([417f71f](https://github.com/NikolasVir/journalt/commit/417f71f1b765618cacd1d0bd6a3b635184bdfd6b))

## [1.0.1](https://github.com/NikolasVir/journalt/compare/v1.0.0...v1.0.1) (2026-10-09)


### Bug Fixes

* **docker:** use groupadd and useradd in runtime ([4e66ebf](https://github.com/NikolasVir/journalt/commit/4e66ebf7f87bcbcb0237fda46385d8e01c23d23e))

## 1.0.0 (2026-10-09)


### Features

* add libraries, tags and note lifecycle ([66a2024](https://github.com/NikolasVir/journalt/commit/66a2024ef6f0c208eed8197ff003bd50a870c7df))
* add markdown enhancer with prism and katex ([7cb06e0](https://github.com/NikolasVir/journalt/commit/7cb06e0473e3f7da60d6f52bfe84cbd89c256f73))
* **api:** add antiforgery csrf protection ([6b8db68](https://github.com/NikolasVir/journalt/commit/6b8db682fc29590789dd85344541fd7d3d36b82f))
* **api:** add Api project and configuration ([ce3e05b](https://github.com/NikolasVir/journalt/commit/ce3e05bb3de29fbd3cecec0524d3e9adb45b543c))
* **api:** add apikey controller and global auth ([fe0192a](https://github.com/NikolasVir/journalt/commit/fe0192aabce52b2b03fb67c08f0d1c3c8df9eecd))
* **api:** add auth controller and registration toggle ([ce5b5d8](https://github.com/NikolasVir/journalt/commit/ce5b5d867e2c1554dee4c23cd3246c0ee7d4e356))
* **api:** add avatar and password endpoints ([30f99d3](https://github.com/NikolasVir/journalt/commit/30f99d32b5f6a4b71fbd8faf49c2e5521b1ea78f))
* **api:** add health check and auto-migrations ([c1849a2](https://github.com/NikolasVir/journalt/commit/c1849a23360561367426819c3036655552e10b56))
* **api:** add security headers and 404 handler ([2689359](https://github.com/NikolasVir/journalt/commit/2689359249fdae76ed4bdfaa9242587c89b528cd))
* **api:** add sort parameters for notes ([399c94f](https://github.com/NikolasVir/journalt/commit/399c94ff5071c36461ece3cad386f7f64d45036e))
* **api:** add SPA hosting and Docker build ([aa8145b](https://github.com/NikolasVir/journalt/commit/aa8145ba763e31809bca8dce7b5d1fe2ab6986e3))
* **api:** adopt rfc 9457 problem details ([1b0e3a9](https://github.com/NikolasVir/journalt/commit/1b0e3a9c576c34d46aa13d132a93d637c4efe55a))
* **api:** auto-apply migrations in development ([cc78f7a](https://github.com/NikolasVir/journalt/commit/cc78f7aebd714045ce99b97e8a11fd508b61bc93))
* **api:** expose wiki index and note backlinks ([7e37e43](https://github.com/NikolasVir/journalt/commit/7e37e43a017a90c6f8927529830dc8b6af03b832))
* **api:** wire infrastructure and auth middleware ([a1858f8](https://github.com/NikolasVir/journalt/commit/a1858f84ac7a1ea070755358aeaaa5e8cf35c029))
* **application:** add apikey and user contracts ([1b63f5e](https://github.com/NikolasVir/journalt/commit/1b63f5e0b4a4b85aa0bba60654ee1c8290446c57))
* **application:** add auth contracts and options ([18ab589](https://github.com/NikolasVir/journalt/commit/18ab589c4dcab5282c989e427eee3f861344a8ad))
* **application:** add db context interface ([789acb0](https://github.com/NikolasVir/journalt/commit/789acb02f2a901755f5f50ab384f5f413cd32687))
* **auth:** seed default admin user on startup ([74984e1](https://github.com/NikolasVir/journalt/commit/74984e18532e517ba1589188273de074906d7d61))
* **capture:** support library selection in quick capture ([158d10f](https://github.com/NikolasVir/journalt/commit/158d10f3e1e5cc48036b64a754a48cf35fbd306b))
* **card:** move actions to header 3-dots menu ([69fb89d](https://github.com/NikolasVir/journalt/commit/69fb89dfa13d79eb2b399c39972cdcd082e80137))
* **client:** add Angular Material SPA ([5b3484e](https://github.com/NikolasVir/journalt/commit/5b3484ecc1082d38696b3b3d86ae0f3a7eb71879))
* **client:** add avatar component and services ([78a840d](https://github.com/NikolasVir/journalt/commit/78a840d4f39a16be91c10b9a0efb674e1b667976))
* **client:** add Journal Type selection in UI ([0429b9a](https://github.com/NikolasVir/journalt/commit/0429b9ae66c91474596de0c1f1ab61025ce0cbe6))
* **client:** add Keep dark theme and toggle ([4e2e6d6](https://github.com/NikolasVir/journalt/commit/4e2e6d6a20fb2eef9efb2e30e9f5f53edfe7687c))
* **client:** add real-time collaborative ChecklistEditor component ([f4e65b7](https://github.com/NikolasVir/journalt/commit/f4e65b746f5cbda45530e33012393e41fc4ae6d3))
* **client:** add user service and share dialog ([9c57839](https://github.com/NikolasVir/journalt/commit/9c5783984fd9cf9ee8c30113e14c47f01e56d770))
* **client:** integrate list notes into quick capture, note cards, dialogs, and detail views ([72989ac](https://github.com/NikolasVir/journalt/commit/72989ac5f54493bd7ab89a136b9511283833c0a4))
* **client:** integrate share dialog across UI ([ca76478](https://github.com/NikolasVir/journalt/commit/ca76478fc9011ea564781d0503f2ea242a848e73))
* **client:** show version in sidebar footer ([e492b79](https://github.com/NikolasVir/journalt/commit/e492b79b902af21946c91b0bdc7a081609497d50))
* **collab:** add real-time collab with Yjs ([c6cdc93](https://github.com/NikolasVir/journalt/commit/c6cdc93c14edc813dc6a9a982b677980930900f5))
* **core:** add Domain and Application projects ([ac25bdb](https://github.com/NikolasVir/journalt/commit/ac25bdba930f3ca24289aea5048d55b34358bc84))
* **db:** add avatar url to users table ([f6defec](https://github.com/NikolasVir/journalt/commit/f6defec174398cf8fc50ef98c15cee2615f3b872))
* **dialog:** add library assignment, sources validation, and collapsible sections to note dialog ([ec58372](https://github.com/NikolasVir/journalt/commit/ec58372c35479f070ddb4aab6a6ca5abfd4e27ba))
* **domain:** add tag definitions and migration ([0f775ed](https://github.com/NikolasVir/journalt/commit/0f775edfde5852789cfcc0ac65e25887752ea22d))
* **domain:** implement core entities and enums ([cf057e4](https://github.com/NikolasVir/journalt/commit/cf057e4dec27a81063e153032b19502d5862407e))
* **editor:** shared CodeMirror markdown editor ([7a8a36f](https://github.com/NikolasVir/journalt/commit/7a8a36fb339504a2fd1d2ec5e457eefd47b4a26c))
* **explore:** add wiki tree and reader ([9b84da6](https://github.com/NikolasVir/journalt/commit/9b84da654ea83a64e8e38fe3944c00edee15c9ec))
* **explore:** edit note and return to explorer ([96be1f4](https://github.com/NikolasVir/journalt/commit/96be1f4257b2a04239993d621aafd142e9114f5e))
* **explore:** pin metadata and add resizer ([d7288b2](https://github.com/NikolasVir/journalt/commit/d7288b256bf8697a8476ee545f6ca98741df4c65))
* **explore:** resizable tree column ([db1e1a6](https://github.com/NikolasVir/journalt/commit/db1e1a6e1b4e2716f4235c50ac401c830aa3a5e6))
* **explore:** responsive tree navigation and mobile back button ([4890055](https://github.com/NikolasVir/journalt/commit/48900557b70c8368d56209efab6fa506306e1639))
* **explore:** toggle library on row click ([8190e5d](https://github.com/NikolasVir/journalt/commit/8190e5dc695a7776852d7e47c7ea0222865350c0))
* **feeds:** 2-column mobile grid and list view mode toggle ([1021c5d](https://github.com/NikolasVir/journalt/commit/1021c5d3ba6a486deabe794e3a8ba352e2ca645c))
* **infra:** add active apikey name unique index ([003a9df](https://github.com/NikolasVir/journalt/commit/003a9dfd3730b2729fcbc1ee9e5f44e855390b1f))
* **infra:** add Infrastructure with dependencies ([4b49d2d](https://github.com/NikolasVir/journalt/commit/4b49d2ddb790a71a2d31dfaf7cccbdc3543089fd))
* **infra:** add initial ef core migration ([79daf91](https://github.com/NikolasVir/journalt/commit/79daf91d2626d131d69ccb2047b1ba26526835ad))
* **infra:** add markdown and type validation ([0b98624](https://github.com/NikolasVir/journalt/commit/0b98624bb275bc8d13ede801e15ece8a5b8061f2))
* **infra:** configure ef core and identity ([1db1d66](https://github.com/NikolasVir/journalt/commit/1db1d66e5cacf966b1091aa7602bd8bed5547dcb))
* **infra:** implement apikey service and handler ([19af197](https://github.com/NikolasVir/journalt/commit/19af197d51e2320bfdbaa580be6c00e82aea5ab9))
* **infra:** implement cookie auth and AuthService ([dde3840](https://github.com/NikolasVir/journalt/commit/dde384001b5db6ecef69de6ec322c1bc3557c95f))
* **layout:** add header avatar menu dropdown ([ae6c030](https://github.com/NikolasVir/journalt/commit/ae6c030f496e1bf261c6e42083d7e69ee8458d27))
* **layout:** responsive shell, drawer navigation, and mobile user footer ([13aad0f](https://github.com/NikolasVir/journalt/commit/13aad0f0fd6bb9d005dc720b201f1dda7faf6eee))
* **nav:** move todos tab to second item ([f4e4607](https://github.com/NikolasVir/journalt/commit/f4e460795f42064fad8fcf2e50ec757801dfa5b0))
* **notes:** add tag chips with autocomplete ([c7c1c81](https://github.com/NikolasVir/journalt/commit/c7c1c815a1c096df81e114262b18637f6d648f01))
* **notes:** add todo hub and multi-facet search ([40a4cf8](https://github.com/NikolasVir/journalt/commit/40a4cf8ab3807ab4407d952de4b8aca9923254ca))
* **notes:** adopt editor in dialog and capture ([0e91d93](https://github.com/NikolasVir/journalt/commit/0e91d93c3d584e6c8d1d4449ef2bddb78cf151ea))
* **notes:** file notes into libraries from editor ([f2550f4](https://github.com/NikolasVir/journalt/commit/f2550f4bf7abfcb6e934a8a1debeb36d824c7b9a))
* **notes:** group feed into date timeline ([566075b](https://github.com/NikolasVir/journalt/commit/566075bc033b4dc45865e5727bfe155fbc7db764))
* **notes:** implement core notes crud and api ([8eee642](https://github.com/NikolasVir/journalt/commit/8eee64253f0e3ab8270be6111190159615df7d3c))
* **notes:** responsive in-flow card actions, dialogs, and editor wrapping ([67824af](https://github.com/NikolasVir/journalt/commit/67824afb5602971807e64252b4879d68e12879f5))
* **notes:** rework note edit page layout ([cdb877f](https://github.com/NikolasVir/journalt/commit/cdb877f9366a64013c00ff317b7dded67b95bf0e))
* **notes:** support instant undo when trashing notes and tasks across views ([8144425](https://github.com/NikolasVir/journalt/commit/81444250dc394ad881ddcb60f30f62572df1f3e6))
* **notes:** universal edit pen navigation ([155f89c](https://github.com/NikolasVir/journalt/commit/155f89c7cef395d9dca116efee2892ced1de0d59))
* **notification:** add showUndo snackbar action and styling ([0ed4071](https://github.com/NikolasVir/journalt/commit/0ed40718254ceb8e9abe2225b27ad5b39b725be0))
* **quick-capture:** convert to dialog modal ([dc2feb9](https://github.com/NikolasVir/journalt/commit/dc2feb9e8041f67c56af807633478a90fe82ba91))
* **routes:** add dedicated 404 not found page ([a29d65f](https://github.com/NikolasVir/journalt/commit/a29d65f5694a2ebf8520cc4f4e40c81605cfcf89))
* **search:** sync search, tag, and library filters to URL with active filters bar and clickable tags ([d8840c8](https://github.com/NikolasVir/journalt/commit/d8840c8ae3a9df3f5bf02dae9cc59892f8ae552a))
* **server:** add minver and version endpoint ([744bba9](https://github.com/NikolasVir/journalt/commit/744bba9105a111d1f772cc3498db6058a5d750b9))
* **server:** add NoteFormat enum, EF Core migration, and backend validation ([915b245](https://github.com/NikolasVir/journalt/commit/915b245abf20f690bdfb4af7c09b0ed16616409a))
* **server:** add NoteShare entity and schema ([11a35f3](https://github.com/NikolasVir/journalt/commit/11a35f3577e11c3dd64c16ec5d01c3aadc7a6b8b))
* **server:** note sharing API and permissions ([d56c2a2](https://github.com/NikolasVir/journalt/commit/d56c2a264c940ad75c7d12d09c2670278d8e428f))
* **settings:** add avatar upload and pass change ([20b6353](https://github.com/NikolasVir/journalt/commit/20b635331711fc78b73c1bcfcb40ac6494343b23))
* **settings:** add sign out button to profile ([a88c0ee](https://github.com/NikolasVir/journalt/commit/a88c0eead4a678203f7e151f878a8832508c1550))
* **tags:** add registry-backed journal tag selection ([185e462](https://github.com/NikolasVir/journalt/commit/185e462f7d1af39d937a41f9083780ff65bf8036))
* type migration API, wiki-link warnings, CI workflow, Docker ([4a7cdae](https://github.com/NikolasVir/journalt/commit/4a7cdae48edcdd9608ec9ae146073d02e9447791))
* **types:** add builder, viewer, and guide ([c2b0d89](https://github.com/NikolasVir/journalt/commit/c2b0d893cc030a40128d04d7a0d13130c9ea5df0))
* **types:** add type definitions and versioning ([184e7fa](https://github.com/NikolasVir/journalt/commit/184e7fa9a125ca892847e719801c435570703956))
* **types:** move editor to dedicated page ([4d705ed](https://github.com/NikolasVir/journalt/commit/4d705edc99d48321d7bf83ae82a77a15647962b8))
* **ui:** support escape key to dismiss dialogs ([724ef99](https://github.com/NikolasVir/journalt/commit/724ef99097b820d547e779d75c26d85a87b1fa0d))
* **viewer:** add metadata column to note views ([d4e511a](https://github.com/NikolasVir/journalt/commit/d4e511a1c547520d3b134285be91b5f54553f01e))


### Bug Fixes

* **api:** resolve wiki links on every read ([2d4a33b](https://github.com/NikolasVir/journalt/commit/2d4a33b7f2587065feba377ff99db741af61aa08))
* **client:** anchor tags to bottom of notes in dialog and cards ([404708c](https://github.com/NikolasVir/journalt/commit/404708c2badce76b1d6c1a7b08f098ec0bb01247))
* **client:** disable critical css inline for csp ([c8e1eda](https://github.com/NikolasVir/journalt/commit/c8e1edab6d0dd954b087196e58c2ea872963525d))
* **client:** keep header visible while scrolling ([e67ce27](https://github.com/NikolasVir/journalt/commit/e67ce27bd94dd27152dd6d0869fa51848c74907e))
* **client:** keep navigation icons stationary during sidebar transition ([7018347](https://github.com/NikolasVir/journalt/commit/701834715fa229388acddd24dda9deebfdedb1b7))
* **client:** keep note dialog open after outside drag ([83e6c56](https://github.com/NikolasVir/journalt/commit/83e6c56016b0a579b503b364fb2fa02b555fb3f5))
* **client:** settings avatar gap & auth inputs ([d2016cc](https://github.com/NikolasVir/journalt/commit/d2016cc4f91574ef0b40b9a8a3ecc483dfe2578d))
* **collab:** authorize hub and bound sync queue ([29cd9bf](https://github.com/NikolasVir/journalt/commit/29cd9bfda60579d57b794abfc6a31ae560dae9e0))
* **deps:** resolve sqlitepclraw vulnerability ([5de92af](https://github.com/NikolasVir/journalt/commit/5de92af21b2c288cc10324e1c3d7227a6345e7a9))
* **dialog:** shadow sidebar and top bar on modal ([d521186](https://github.com/NikolasVir/journalt/commit/d52118621e0642f974cb40a1edb728ca22330607))
* **explore:** keep note trail on browser back ([6cd4e31](https://github.com/NikolasVir/journalt/commit/6cd4e31c299338024e67992314292c4b8dd2f862))
* **layout:** prevent brand truncate on tablet ([74fe485](https://github.com/NikolasVir/journalt/commit/74fe4857fbe86cd8ce19aae46df7feacd3feab66))
* **libraries:** enforce case-insensitive uniqueness ([8fa6ece](https://github.com/NikolasVir/journalt/commit/8fa6ece5952322eba620accead033f9dd02af7a8))
* **libraries:** scope tree and list to user ([b592298](https://github.com/NikolasVir/journalt/commit/b5922985c8741a1d25990294475008356fd018f2))
* **notes:** add page header & nowrap buttons ([cd64e3d](https://github.com/NikolasVir/journalt/commit/cd64e3db07d9ccda931502d49226330bfa67c272))
* **notes:** dialog layout & collab badge color ([fd09bba](https://github.com/NikolasVir/journalt/commit/fd09bba2de0af9506b58a417559936e492b54dd4))
* **notes:** include tags and body in summary ([e82da47](https://github.com/NikolasVir/journalt/commit/e82da477c7cba69f3a06b537f0fcbfd4cb3e937e))
* **notes:** scope tags and library to user ([3a38428](https://github.com/NikolasVir/journalt/commit/3a38428e06030cefedaf0575637ff7a9aef5744f))
* **notes:** streamline editor and shared library ([f43e25f](https://github.com/NikolasVir/journalt/commit/f43e25f07d83a88acc9c6c0a6f8c633e5ab35782))
* resolve CSRF and Journal quick capture save ([90ca9c5](https://github.com/NikolasVir/journalt/commit/90ca9c529326743b1b36c26cc2b9e291fadd6383))
* **security:** proxy headers, csp, auth defaults ([150eb7c](https://github.com/NikolasVir/journalt/commit/150eb7c89cdd6147461723ad02f19d593278bfd4))
* **server:** clear default forwarded proxy headers ([8fa95de](https://github.com/NikolasVir/journalt/commit/8fa95dee96c4f0ed4134f455a57b74768ea585a4))
* **server:** rate limits, cookies, and backups ([2243092](https://github.com/NikolasVir/journalt/commit/224309296719ab821c1ff9fc1bd33c8fec1b8064))
* **styles:** disable mobile touch tap highlight color flash ([1a1fa05](https://github.com/NikolasVir/journalt/commit/1a1fa054eebb48ab371674a3713ae1d93a8d12f6))
* **styles:** map warn buttons & dark badges ([b60bc05](https://github.com/NikolasVir/journalt/commit/b60bc05fc7fa54437f1096be2709acc46b95be34))
* **todos:** preserve completed tasks after refresh ([8102f06](https://github.com/NikolasVir/journalt/commit/8102f060e4590914d1eb3f0df3b2a38cb2fc559c))
* truncate note title and preserve level badge ([ab8974a](https://github.com/NikolasVir/journalt/commit/ab8974a8ad7db8f083e2bbe0352cf9a9b1b24520))
* **types:** button clipping, h1 font, padding ([9701cac](https://github.com/NikolasVir/journalt/commit/9701cac24545871be9f8a42e6bb1bb47d853e580))
* **ui:** improve contrast and register checks ([ed2d94e](https://github.com/NikolasVir/journalt/commit/ed2d94eb1a61df7eabaf2cdd4639ccc314d41874))
* **ui:** style budgets and token fallbacks ([804d6ba](https://github.com/NikolasVir/journalt/commit/804d6ba921a08eba9f7c51396a208e047e11fe99))
* **validation:** check avatar url and title max ([aa6802c](https://github.com/NikolasVir/journalt/commit/aa6802c22858bc135cb59502db5377dcda120590))
* **views:** explore h1 size & todos stats grid ([5492d01](https://github.com/NikolasVir/journalt/commit/5492d01d7acf063a62d25765de2bdc721956d672))


### Performance Improvements

* **client:** self-host roboto and material icons ([a52fcb7](https://github.com/NikolasVir/journalt/commit/a52fcb7f3408f22a14e091e407c5c209c159c609))
