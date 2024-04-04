// Define generic interfaces for entities and queries

export type UnwrapArray<T> = T extends Array<infer U> ? U : T;

export type QueryType<S> = {
    [K in keyof S]: {
        type: K;
        args?: Record<string, unknown>;
        manipulate?: (entity: S[K]) => S[K];
        fields: {
            [I in keyof UnwrapArray<S[K]>]?: boolean | QueryType<S>;
        };
    }
}[keyof S]

export type QueryResultType<S> = {
    [K in keyof S]: {
        __type: K;
        fields: {
            [I in keyof S[K]]?: boolean | QueryType<S>;
        };
    }
}[keyof S]

interface Query<S> {
    type: keyof S;
    resolver: (args: any) => Promise<S[keyof S] | null> | S[keyof S] | null;
}

type resolverStoreItem<S, SK> = {
    type: keyof S;
    resolver: (entity: SK, args?: any) => Promise<S[keyof S] | null> | S[keyof S] | null;
}
type resolverStore<SS, SK extends string | number | symbol> = Record<SK, Record<keyof SK, resolverStoreItem<SS, SK>>>;

// Define a generic GraphQL service class
export class GraphQLService<Schemas> {
    private queries: Record<keyof Schemas, Query<Schemas>> = {} as Record<keyof Schemas, Query<Schemas>>;
    private resolvers: resolverStore<Schemas, keyof Schemas> = {} as resolverStore<Schemas, keyof Schemas>;

    // Register a query with its resolver function
    registerQuery(type: keyof Schemas, resolver: (args: any) => Promise<Schemas[typeof type] | null> | Schemas[typeof type] | null) {
        this.queries[type] = { type, resolver };
    }

    // Register a field-level resolver for an entity
    registerResolver(entityName: keyof Schemas, fieldName: keyof [typeof entityName], type: keyof Schemas, resolver: (entity: [typeof entityName], args?: any) => Promise<Schemas[typeof type] | null> | Schemas[typeof type] | null) {
        if (!this.resolvers[entityName]) {
            // @ts-ignore
            this.resolvers[entityName] = {
                [fieldName]: {
                    type,
                    resolver
                }
            };
        }
        // @ts-ignore
        this.resolvers[entityName][fieldName] = {
            type,
            resolver
        };
    }

    private async manipulateResult(result: any, q: QueryType<Schemas>) {
        if (q.manipulate) {
            return q.manipulate(await result);
        }
        return result;
    }

    // Execute a query by name with provided arguments and selected fields
    async executeQuery<T extends keyof Schemas>(q: QueryType<Schemas>): Promise<Partial<Schemas[T]> | null> {
        const query = this.queries[q.type];
        if (!query) {
            throw new Error(`Query '${String(q.type)}' not found`);
        }
        const result = await this.manipulateResult(query.resolver(q.args),q);

        if (!result) {
            return null;
        }
        if (!q.fields) {
            const selectedFieldsName = Object.keys(result) as (keyof Schemas[T])[];
            return this.createPartial<T>(q.type as T, result as Schemas[T], selectedFieldsName);
        }
        // @ts-ignore
        if (q.type.startsWith('[')) {
            // @ts-ignore
            return Promise.all(result.map(async (r) => this.applyResolversRecursive(r as Schemas[typeof q.type], q)));
        } else {
            return this.applyResolversRecursive(result as Schemas[typeof q.type], q) as Promise<Partial<Schemas[T]> | null>;
        }
    }

    private async applyResolversRecursive(result: Schemas[typeof q.type], q: QueryType<Schemas>) {
        const selectedFieldsName = Object.keys(q.fields) as (keyof Schemas[typeof q.type])[];
        // @ts-ignore
        const type=q.type.startsWith('[')?q.type.slice(1,-1):q.type;
        for (const fieldName in q.fields) {
            if (!result?.hasOwnProperty(fieldName)) {
                // @ts-ignore
                if (this.resolvers[type] && this.resolvers[type][fieldName]) {
                    // @ts-ignore
                    const fieldValue = await this.resolvers[type][fieldName].resolver(result, q?.args);
                    if (fieldValue) {
                        // @ts-ignore
                        result[fieldName] = fieldValue;
                    }
                }
                // @ts-ignore
                if (typeof q.fields[fieldName] === 'object' && typeof result[fieldName] !== 'undefined' && typeof result[fieldName] === 'object') {
                    const subFields = q.fields[fieldName];
                    // @ts-ignore
                    if (Array.isArray(result[fieldName])) {
                        // @ts-ignore
                        for (let index = 0; index < result[fieldName].length; index++) {
                            // @ts-ignore
                            const subResult = result[fieldName][index];
                            // @ts-ignore
                            result[fieldName][index] = await this.applyResolversRecursive(subResult, subFields as QueryType<Schemas>); // Add type assertion
                        }

                    } else {
                        // @ts-ignore
                        result[fieldName as string] = await this.applyResolversRecursive(result[fieldName as string], subFields as QueryType<Schemas>); // Add type assertion
                    }
                }
            }
        }
        return this.createPartial(type, result, selectedFieldsName);
    };

    private createPartial<T extends keyof Schemas>(type: T, result: Schemas[T], selectedFieldsName: (keyof Schemas[T])[]) {
        const r: Schemas[T] & { __type: T } = { ...result, __type: type };
        const selectedResult: Partial<Schemas[T]> = {};
        for (const fieldName of Object.keys(r)) {
            if (fieldName === '__type' || selectedFieldsName.includes(fieldName as keyof Schemas[T])) {
                // @ts-ignore
                selectedResult[fieldName] = r[fieldName];
            }
        }
        return selectedResult;
    }

}