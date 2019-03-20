import Vue from "vue"
import { Module, ActionContext } from "vuex"
import { Moment } from "moment"
import moment from "moment"

import { IRef, FetchError, momentLocale } from "@/utils"
import * as Api from "@/api"
import { IResultViewInfo, IExecutedRow, SchemaName, EntityName, ValueType } from "@/api"

export type UserViewType = "named" | "anonymous"

export interface IUserViewArguments {
    type: UserViewType
    source: string
    args: URLSearchParams | null
}

export class UserViewResult {
    args: IUserViewArguments
    info: IResultViewInfo
    attributes: Record<string, any>
    columnAttributes: Array<Record<string, any>>
    rows: IExecutedRow[] | null
    // Row ids to row positions, actual key is Api.RowId
    updateRowIds: Record<string, number> = {}
    // Column names to column positions
    updateColumnIds: Record<string, number> = {}

    constructor(args: IUserViewArguments, info: IResultViewInfo, attributes: Record<string, any>, columnAttributes: Array<Record<string, any>>, rows: IExecutedRow[] | null) {
        this.args = args
        this.info = info
        this.attributes = attributes
        this.columnAttributes = columnAttributes
        this.rows = rows

        if (rows !== null) {
            info.columns.forEach((columnInfo, colI) => {
                if (columnInfo.valueType.type === "datetime" || columnInfo.valueType.type === "date") {
                    rows.forEach(row => {
                        const cell = row.values[colI]
                        if (typeof cell.value === "number") {
                            const str = cell.value
                            cell.value = moment(cell.value * 1000)
                        }
                    })
                }
            })

            this.updateRowIds = rows.reduce((rowIds: Record<string, number>, row, rowI) => {
                if (row.id !== undefined) {
                    rowIds[row.id] = rowI
                }
                return rowIds
            }, {})
        }

        if (info.updateEntity !== null) {
            this.updateColumnIds = info.columns.reduce((colIds: Record<string, number>, col, colI) => {
                if (col.updateField !== null) {
                    colIds[col.updateField.name] = colI
                }
                return colIds
            }, {})
        }
    }
}

// For each entity contains array of all accessible entries identified by main field
export type Entries = Record<string, number>
export type EntriesMap = Record<SchemaName, Record<EntityName, Entries | Promise<Entries>>>

export type UserViewErrorType = "forbidden"

export class UserViewError extends Error {
    message: UserViewErrorType
    args: IUserViewArguments

    constructor(message: UserViewErrorType, args: IUserViewArguments) {
        super(message)
        this.message = message
        this.args = args
    }
}

export class CurrentUserViews {
    userViews: Record<string, UserViewResult | UserViewError | Promise<UserViewResult>> = {}

    get rootView() {
        const uv = this.userViews[""]
        if (uv === null || uv instanceof Promise) {
            return null
        } else {
            return uv
        }
    }

    setUserView(args: IUserViewArguments | null, uv: UserViewResult | UserViewError | Promise<UserViewResult>) {
        Vue.set(this.userViews, args === null ? "" : userViewHash(args), uv)
    }

    getUserView(args: IUserViewArguments) {
        const uv = this.userViews[userViewHash(args)]
        if (uv instanceof UserViewResult) {
            return uv
        } else {
            return null
        }
    }
}

export interface IUserViewState {
    current: CurrentUserViews
    pending: Promise<UserViewResult> | null
    entries: EntriesMap
    errors: string[]
}

export const dateFormat = "L"
export const dateTimeFormat = "L LTS"

// Should be in sync with staging_changes.validateValue
export const printValue = (valueType: ValueType, value: any): string => {
    if (value === null) {
        return ""
    } else if (valueType.type === "date") {
        return (value as Moment).format(dateFormat)
    } else if (valueType.type === "datetime") {
        return (value as Moment).format(dateTimeFormat)
    } else {
        return String(value)
    }
}

const userViewHash = (args: IUserViewArguments) => `${args.type}__${args.source}__${args.args}`

const getUserView = async ({ dispatch }: ActionContext<IUserViewState, {}>, args: IUserViewArguments): Promise<UserViewResult | UserViewError> => {
    try {
        let current: UserViewResult
        if (args.type === "named") {
            if (args.args === null) {
                const res: Api.IViewInfoResult = await dispatch("callProtectedApi", {
                    func: Api.fetchNamedViewInfo,
                    args: [args.source],
                }, { root: true })
                await momentLocale
                current = new UserViewResult(args, res.info, res.pureAttributes, res.pureColumnAttributes, null)
            } else {
                const res: Api.IViewExprResult = await dispatch("callProtectedApi", {
                    func: Api.fetchNamedView,
                    args: [args.source, args.args],
                }, { root: true })
                await momentLocale
                current = new UserViewResult(args, res.info, res.result.attributes, res.result.columnAttributes, res.result.rows)
            }
        } else {
            if (args.args === null) {
                throw Error("Getting information about anonymous views is not supported")
            } else {
                const res: Api.IViewExprResult = await dispatch("callProtectedApi", {
                    func: Api.fetchAnonymousView,
                    args: [args.source, args.args],
                }, { root: true })
                await momentLocale
                current = new UserViewResult(args, res.info, res.result.attributes, res.result.columnAttributes, res.result.rows)
            }
        }
        return current
    } catch (e) {
        if (e instanceof FetchError) {
            if (e.response.status === 403) {
                return new UserViewError("forbidden", args)
            }
        }

        throw e
    }
}

const userViewModule: Module<IUserViewState, {}> = {
    namespaced: true,
    state: {
        current: new CurrentUserViews(),
        pending: null,
        entries: {},
        errors: [],
    },
    mutations: {
        addError: (state, lastError: string) => {
            state.errors.push(lastError)
        },
        removeError: (state, errorIndex: number) => {
            state.errors.splice(errorIndex, 1)
        },
        setUserView: (state, { args, userView }: { args: IUserViewArguments | null, userView: UserViewResult | Promise<UserViewResult> }) => {
            state.current.setUserView(args, userView)
        },
        setPending: (state, pending: Promise<UserViewResult>) => {
            state.pending = pending
        },
        clear: state => {
            state.pending = null
            state.current = new CurrentUserViews()
            state.entries = {}
            state.errors = []
        },
        setEntries: (state, { schemaName, entityName, entries }: { schemaName: string, entityName: string, entries: Entries | Promise<Entries> }) => {
            let entities = state.entries[schemaName]
            if (entities === undefined) {
                entities = {}
                Vue.set(state.entries, schemaName, entities)
            }

            Vue.set(entities, entityName, entries)
        },
        clearEntries: (state, { schemaName, entityName }: { schemaName: string, entityName: string }) => {
            const entities = state.entries[schemaName]
            if (entities === undefined) {
                return
            }

            Vue.delete(entities, entityName)
        },
    },
    actions: {
        getEntries: ({ state, commit, dispatch }, { schemaName, entityName }: { schemaName: string, entityName: string }) => {
            const currentSchema = state.entries[schemaName]
            if (currentSchema !== undefined) {
                if (entityName in  currentSchema) {
                    return
                }
            }

            const pending: IRef<Promise<Entries>> = {}
            pending.ref = (async () => {
                try {
                    const name = `__Summary__${schemaName}__${entityName}`
                    const res: Api.IViewExprResult = await dispatch("callProtectedApi", {
                        func: Api.fetchNamedView,
                        args: [name, new URLSearchParams()],
                    }, { root: true })
                    if (!(schemaName in state.entries && state.entries[schemaName][entityName] === pending.ref)) {
                        throw Error("Pending operation cancelled")
                    }
                    const entries = res.result.rows.reduce((currEntries: Record<string, number>, row) => {
                        const id = row.values[0].value
                        const main = row.values[1].value
                        currEntries[main] = id
                        return currEntries
                    }, {})
                    commit("setEntries", { schemaName, entityName, entries })
                    return entries
                } catch (e) {
                    if (schemaName in state.entries && state.entries[schemaName][entityName] === pending.ref) {
                        commit("clearEntries", { schemaName, entityName })
                    }
                    throw e
                }
            })()
            commit("setEntries", { schemaName, entityName, entries: pending.ref })
        },
        getRootView: (store, args: IUserViewArguments) => {
            const { state, commit } = store
            const pending: IRef<Promise<UserViewResult>> = {}
            pending.ref = (async () => {
                let current: UserViewError | UserViewResult
                try {
                    current = await getUserView(store, args)
                    if (state.pending !== pending.ref) {
                        throw Error("Pending operation cancelled")
                    }
                    commit("clear")
                    commit("setUserView", { args: null, userView: current })
                } catch (e) {
                    if (state.pending === pending.ref) {
                        commit("clear")
                        commit("addError", e.message)
                    }
                    throw e
                }
                if (current instanceof UserViewError) {
                    throw current
                } else {
                    return current
                }
            })()
            commit("setPending", pending.ref)
            return pending.ref
        },
        getNestedView: (store, args: IUserViewArguments) => {
            const { state, commit } = store
            const uvHash = userViewHash(args)
            if (uvHash in state.current.userViews) {
                return
            }

            const pending: IRef<Promise<UserViewResult>> = {}
            pending.ref = (async () => {
                let current: UserViewError | UserViewResult
                try {
                    current = await getUserView(store, args)
                    if (state.current.userViews[uvHash] !== pending.ref) {
                        throw Error("Pending operation cancelled")
                    }
                    commit("setUserView", { args, userView: current })
                } catch (e) {
                    if (state.current.userViews[uvHash] === pending.ref) {
                        commit("addError", e.message)
                    }
                    throw e
                }
                if (current instanceof UserViewError) {
                    throw current
                } else {
                    return current
                }
            })()
            commit("setUserView", { args, userView: pending.ref })
            return pending.ref
        },
        reload: async ({ state, commit, dispatch }) => {
            if (state.current.rootView === null) {
                return
            }
            await dispatch("getRootView", state.current.rootView.args)
        },
    },
}

export default userViewModule
