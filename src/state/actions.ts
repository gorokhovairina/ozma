import { Dispatch } from "vuex";
import { IActionRef, IActionResult } from "ozma-api";

import Api from "@/api";
import { CombinedTransactionResult } from "@/state/staging_changes";

export const saveAndRunAction = async (
  { dispatch }: { dispatch: Dispatch },
  ref: IActionRef,
  args: Record<string, unknown>,
): Promise<IActionResult> => {
  let ret: IActionResult | undefined;
  let reloaded = false;
  try {
    const submitRet: CombinedTransactionResult[] = await dispatch("staging/submit", { preReload: async () => {
      ret = await dispatch("callProtectedApi", {
        func: Api.runAction,
        args: [ref, args],
      }, { root: true });
    } }, { root: true });
    reloaded = submitRet.length !== 0;
  } catch (e) {
    if (ret === undefined) {
      throw e;
    }
  }

  if (!reloaded) {
    void dispatch("reload", undefined, { root: true });
  }
  return ret as IActionResult;
};
