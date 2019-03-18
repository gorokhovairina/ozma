import * as Utils from "@/utils"

const apiUrl = Utils.isProduction ? `https://api.${location.hostname}` : `http://${location.hostname}:5000`

const authUrlBase = Utils.isProduction ? "https://account.myprocessx.com/auth/realms/myprocessx" : "https://keycloak.myprocessx.com/auth/realms/myprocessx-dev"
export const authUrl = `${authUrlBase}/protocol/openid-connect`
export const authClientId = "funapp"
export const authClientSecret = Utils.isProduction ? undefined : "f95ff7a4-5e36-44de-aa43-571f86b21638"

interface IAuthRequest {
    username: string
    password: string
}

interface IAuthResponse {
    token: string
}

export interface IAuthToken {
    sub: string
    exp: number
}

export type DomainId = number
export type RowId = number
export type RowIdString = string
export type FieldName = string
export type EntityName = string
export type SchemaName = string
export type ColumnName = string
export type AttributeName = string

export interface IAllowedEntity {
    fields: Record<FieldName, void>
}

export interface IAllowedSchema {
    entities: Record<EntityName, IAllowedEntity>
}

export interface IAllowedDatabase {
    schemas: Record<SchemaName, IAllowedSchema>
}

export interface IEntityRef {
    schema: SchemaName
    name: EntityName
}

export interface IFieldRef {
    entity: IEntityRef
    name: FieldName
}

export type SimpleType = "int" | "decimal" | "string" | "bool" | "datetime" | "date" | "regclass"

export interface IScalarSimpleType {
    type: SimpleType
}

export interface IArraySimpleType {
    type: "array"
    subtype: SimpleType
}

export type ValueType = IScalarSimpleType | IArraySimpleType

export type FieldValueType = "int" | "decimal" | "string" | "bool" | "datetime" | "date"

export type AttributesMap = Record<AttributeName, any>
export type AttributeTypesMap = Record<AttributeName, ValueType>

export interface IScalarFieldType {
    type: FieldValueType
}

export interface IArrayFieldType {
    type: "array"
    subtype: FieldValueType
}

export interface IReferenceFieldType {
    type: "reference"
    entity: IEntityRef
    where: string
}

export interface IEnumFieldType {
    type: "enum"
    values: string[]
}

export type FieldType = IScalarFieldType | IArrayFieldType | IReferenceFieldType | IEnumFieldType

export interface IColumnField {
    fieldType: FieldType
    defaultValue: any
    isNullable: boolean
}

export interface IMainFieldInfo {
    name: FieldName
    field: IColumnField
}

export interface IResultColumnInfo {
    name: string
    attributeTypes: AttributeTypesMap
    cellAttributeTypes: AttributeTypesMap
    valueType: ValueType
    punType: ValueType | null
    mainField: IMainFieldInfo | null
}

export interface IDomainField {
    ref: IFieldRef
    field: IColumnField
    idColumn: ColumnName
}

export interface IMainEntityInfo {
    entity: IEntityRef
}

export interface IResultViewInfo {
    attributeTypes: AttributeTypesMap
    rowAttributeTypes: AttributeTypesMap
    domains: Record<DomainId, Record<ColumnName, IDomainField>>
    mainEntity: IMainEntityInfo | null
    columns: IResultColumnInfo[]
}

export interface IExecutedValue {
    value: any
    attributes?: AttributesMap
    pun?: any
}

export interface IExecutedRow {
    values: IExecutedValue[]
    domainId: DomainId
    attributes?: AttributesMap
    entityIds?: Record<ColumnName, RowId>
}

export interface IExecutedViewExpr {
    attributes: AttributesMap
    columnAttributes: Array<AttributesMap>
    rows: IExecutedRow[]
}

export interface IViewExprResult {
    info: IResultViewInfo
    result: IExecutedViewExpr
}

export interface IViewInfoResult {
    info: IResultViewInfo
    pureAttributes: Record<AttributeName, any>
    pureColumnAttributes: Array<Record<AttributeName, any>>
}

const fetchApi = async (subUrl: string, token: string, method: string, body?: string): Promise<any> => {
    return await Utils.fetchSuccess(`${apiUrl}/${subUrl}`, {
        method,
        headers: {
            "Authorization": `Bearer ${token}`,
        },
        body,
    })
}

const fetchJsonApi = async (subUrl: string, token: string, method: string, body?: any): Promise<any> => {
    return await Utils.fetchJson(`${apiUrl}/${subUrl}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    })
}

export const fetchAllowed = async (token: string): Promise<IAllowedDatabase> => {
    return await fetchJsonApi("permissions/allowed", token, "GET")
}

const fetchView = async (path: string, token: string, args: URLSearchParams): Promise<IViewExprResult> => {
    return await fetchJsonApi(`views/${path}/entries?${args}`, token, "GET")
}

const fetchViewInfo = async (path: string, token: string, args: URLSearchParams): Promise<IViewInfoResult> => {
    return await fetchJsonApi(`views/${path}/info?${args}`, token, "GET")
}

export const fetchAnonymousView = async (token: string, query: string, args: URLSearchParams): Promise<IViewExprResult> => {
    args.set("__query", query)
    return await fetchView("anonymous", token, args)
}

export const fetchNamedView = async (token: string, name: string, args: URLSearchParams): Promise<IViewExprResult> => {
    return await fetchView(`by_name/${name}`, token, args)
}

export const fetchNamedViewInfo = async (token: string, name: string): Promise<IViewInfoResult> => {
    return await fetchViewInfo(`by_name/${name}`, token, new URLSearchParams())
}

const changeEntity = async (path: string, method: string, token: string, ref: IEntityRef, body?: string): Promise<any> => {
    const schema = ref.schema === null ? "public" : ref.schema
    return await fetchApi(`entity/${schema}/${ref.name}${path}`, token, method, body)
}

export const insertEntry = async (token: string, ref: IEntityRef, args: URLSearchParams): Promise<void> => {
    return await changeEntity("", "POST", token, ref, args.toString())
}

export const updateEntry = async (token: string, ref: IEntityRef, id: number, args: URLSearchParams): Promise<void> => {
    await changeEntity(`/${id}`, "PUT", token, ref, args.toString())
}

export const deleteEntry = async (token: string, ref: IEntityRef, id: number): Promise<void> => {
    await changeEntity(`/${id}`, "DELETE", token, ref)
}
