import { CommandSpec } from "../spec.types";
import { AWS_FIG_SPEC } from "./commands/aws.spec";
import { AZ_FIG_SPEC } from "./commands/az.spec";
import { ARGOCD_FIG_SPEC } from "./commands/argocd.spec";
import { ARTISAN_FIG_SPEC } from "./commands/artisan.spec";
import { CONSUL_FIG_SPEC } from "./commands/consul.spec";
import { BREW_FIG_SPEC } from "./commands/brew.spec";
import { BUNDLE_FIG_SPEC } from "./commands/bundle.spec";
import { BUN_FIG_SPEC } from "./commands/bun.spec";
import { CODE_FIG_SPEC } from "./commands/code.spec";
import { CODE_INSIDERS_FIG_SPEC } from "./commands/code-insiders.spec";
import { COMPOSER_FIG_SPEC } from "./commands/composer.spec";
import { CARGO_FIG_SPEC } from "./commands/cargo.spec";
import { CURL_FIG_SPEC } from "./commands/curl.spec";
import { DBT_FIG_SPEC } from "./commands/dbt.spec";
import { DENO_FIG_SPEC } from "./commands/deno.spec";
import { DF_FIG_SPEC } from "./commands/df.spec";
import { DIG_FIG_SPEC } from "./commands/dig.spec";
import { DOTNET_FIG_SPEC } from "./commands/dotnet.spec";
import { DOCTL_FIG_SPEC } from "./commands/doctl.spec";
import { DOCKER_FIG_SPEC } from "./commands/docker.spec";
import { DOCKER_COMPOSE_FIG_SPEC } from "./commands/docker-compose.spec";
import { DU_FIG_SPEC } from "./commands/du.spec";
import { ESBUILD_FIG_SPEC } from "./commands/esbuild.spec";
import { FD_FIG_SPEC } from "./commands/fd.spec";
import { FFMPEG_FIG_SPEC } from "./commands/ffmpeg.spec";
import { FIND_FIG_SPEC } from "./commands/find.spec";
import { FLUX_FIG_SPEC } from "./commands/flux.spec";
import { FLYCTL_FIG_SPEC } from "./commands/flyctl.spec";
import { FZF_FIG_SPEC } from "./commands/fzf.spec";
import { GCLOUD_FIG_SPEC } from "./commands/gcloud.spec";
import { GIT_FIG_SPEC } from "./commands/git.spec";
import { GH_FIG_SPEC } from "./commands/gh.spec";
import { GO_FIG_SPEC } from "./commands/go.spec";
import { GRADLE_FIG_SPEC } from "./commands/gradle.spec";
import { HELM_FIG_SPEC } from "./commands/helm.spec";
import { JUST_FIG_SPEC } from "./commands/just.spec";
import { JAVA_FIG_SPEC } from "./commands/java.spec";
import { KUBECTL_FIG_SPEC } from "./commands/kubectl.spec";
import { K9S_FIG_SPEC } from "./commands/k9s.spec";
import { KIND_FIG_SPEC } from "./commands/kind.spec";
import { K3D_FIG_SPEC } from "./commands/k3d.spec";
import { K3S_FIG_SPEC } from "./commands/k3s.spec";
import { KUSTOMIZE_FIG_SPEC } from "./commands/kustomize.spec";
import { MAKE_FIG_SPEC } from "./commands/make.spec";
import { MINIKUBE_FIG_SPEC } from "./commands/minikube.spec";
import { MONGOSH_FIG_SPEC } from "./commands/mongosh.spec";
import { MONGO_FIG_SPEC } from "./commands/mongo.spec";
import { MYSQL_FIG_SPEC } from "./commands/mysql.spec";
import { MYSQLDUMP_FIG_SPEC } from "./commands/mysqldump.spec";
import { MVN_FIG_SPEC } from "./commands/mvn.spec";
import { NPM_FIG_SPEC } from "./commands/npm.spec";
import { NODE_FIG_SPEC } from "./commands/node.spec";
import { NOMAD_FIG_SPEC } from "./commands/nomad.spec";
import { NPX_FIG_SPEC } from "./commands/npx.spec";
import { PACKER_FIG_SPEC } from "./commands/packer.spec";
import { PHP_FIG_SPEC } from "./commands/php.spec";
import { PIP_FIG_SPEC } from "./commands/pip.spec";
import { POETRY_FIG_SPEC } from "./commands/poetry.spec";
import { PNPM_FIG_SPEC } from "./commands/pnpm.spec";
import { PSQL_FIG_SPEC } from "./commands/psql.spec";
import { PYTEST_FIG_SPEC } from "./commands/pytest.spec";
import { PYTHON3_FIG_SPEC } from "./commands/python3.spec";
import { PYTHON_FIG_SPEC } from "./commands/python.spec";
import { PULUMI_FIG_SPEC } from "./commands/pulumi.spec";
import { PG_DUMP_FIG_SPEC } from "./commands/pg_dump.spec";
import { PG_RESTORE_FIG_SPEC } from "./commands/pg_restore.spec";
import { RAILS_FIG_SPEC } from "./commands/rails.spec";
import { REDIS_CLI_FIG_SPEC } from "./commands/redis-cli.spec";
import { RG_FIG_SPEC } from "./commands/rg.spec";
import { RSYNC_FIG_SPEC } from "./commands/rsync.spec";
import { RUSTUP_FIG_SPEC } from "./commands/rustup.spec";
import { SAM_FIG_SPEC } from "./commands/sam.spec";
import { SEVEN_Z_FIG_SPEC } from "./commands/7z.spec";
import { SOPS_FIG_SPEC } from "./commands/sops.spec";
import { SQLITE3_FIG_SPEC } from "./commands/sqlite3.spec";
import { SSH_FIG_SPEC } from "./commands/ssh.spec";
import { SSH_KEYGEN_FIG_SPEC } from "./commands/ssh-keygen.spec";
import { TERRAFORM_FIG_SPEC } from "./commands/terraform.spec";
import { TERRAGRUNT_FIG_SPEC } from "./commands/terragrunt.spec";
import { TMUX_FIG_SPEC } from "./commands/tmux.spec";
import { TAR_FIG_SPEC } from "./commands/tar.spec";
import { TURBO_FIG_SPEC } from "./commands/turbo.spec";
import { UV_FIG_SPEC } from "./commands/uv.spec";
import { VAULT_FIG_SPEC } from "./commands/vault.spec";
import { VITE_FIG_SPEC } from "./commands/vite.spec";
import { WEBPACK_FIG_SPEC } from "./commands/webpack.spec";
import { WHOIS_FIG_SPEC } from "./commands/whois.spec";
import { WGET_FIG_SPEC } from "./commands/wget.spec";
import { WC_FIG_SPEC } from "./commands/wc.spec";
import { YARN_FIG_SPEC } from "./commands/yarn.spec";
import { YQ_FIG_SPEC } from "./commands/yq.spec";
import { ZOXIDE_FIG_SPEC } from "./commands/zoxide.spec";
import { ANSIBLE_FIG_SPEC } from "./commands/ansible.spec";
import { ANSIBLE_GALAXY_FIG_SPEC } from "./commands/ansible-galaxy.spec";
import { ANSIBLE_PLAYBOOK_FIG_SPEC } from "./commands/ansible-playbook.spec";
import { JQ_FIG_SPEC } from "./commands/jq.spec";
import { NX_FIG_SPEC } from "./commands/nx.spec";
import { BAT_FIG_SPEC } from "./commands/bat.spec";
import { OP_FIG_SPEC } from "./commands/op.spec";
import { AGE_FIG_SPEC } from "./commands/age.spec";
import { CUT_FIG_SPEC } from "./commands/cut.spec";
import { CAT_FIG_SPEC } from "./commands/cat.spec";
import { CP_FIG_SPEC } from "./commands/cp.spec";
import { GZIP_FIG_SPEC } from "./commands/gzip.spec";
import { GUNZIP_FIG_SPEC } from "./commands/gunzip.spec";
import { GPG_FIG_SPEC } from "./commands/gpg.spec";
import { HEAD_FIG_SPEC } from "./commands/head.spec";
import { HTTP_FIG_SPEC } from "./commands/http.spec";
import { KUBECTX_FIG_SPEC } from "./commands/kubectx.spec";
import { KUBENS_FIG_SPEC } from "./commands/kubens.spec";
import { LS_FIG_SPEC } from "./commands/ls.spec";
import { MV_FIG_SPEC } from "./commands/mv.spec";
import { NSLOOKUP_FIG_SPEC } from "./commands/nslookup.spec";
import { NMAP_FIG_SPEC } from "./commands/nmap.spec";
import { OPENSSL_FIG_SPEC } from "./commands/openssl.spec";
import { RM_FIG_SPEC } from "./commands/rm.spec";
import { SCP_FIG_SPEC } from "./commands/scp.spec";
import { SFTP_FIG_SPEC } from "./commands/sftp.spec";
import { SERVERLESS_FIG_SPEC } from "./commands/serverless.spec";
import { SORT_FIG_SPEC } from "./commands/sort.spec";
import { PODMAN_FIG_SPEC } from "./commands/podman.spec";
import { TAIL_FIG_SPEC } from "./commands/tail.spec";
import { TR_FIG_SPEC } from "./commands/tr.spec";
import { UNIQ_FIG_SPEC } from "./commands/uniq.spec";
import { UNZIP_FIG_SPEC } from "./commands/unzip.spec";
import { XARGS_FIG_SPEC } from "./commands/xargs.spec";
import { XZ_FIG_SPEC } from "./commands/xz.spec";
import { ZIP_FIG_SPEC } from "./commands/zip.spec";
import { ZSTD_FIG_SPEC } from "./commands/zstd.spec";
import { EKSCTL_FIG_SPEC } from "./commands/eksctl.spec";
import { TSC_FIG_SPEC } from "./commands/tsc.spec";
import { ESLINT_FIG_SPEC } from "./commands/eslint.spec";
import { PRETTIER_FIG_SPEC } from "./commands/prettier.spec";
import { JEST_FIG_SPEC } from "./commands/jest.spec";
import { VITEST_FIG_SPEC } from "./commands/vitest.spec";
import { PLAYWRIGHT_FIG_SPEC } from "./commands/playwright.spec";
import { CYPRESS_FIG_SPEC } from "./commands/cypress.spec";
import { PIPX_FIG_SPEC } from "./commands/pipx.spec";
import { PYENV_FIG_SPEC } from "./commands/pyenv.spec";
import { VIRTUALENV_FIG_SPEC } from "./commands/virtualenv.spec";
import { JUPYTER_FIG_SPEC } from "./commands/jupyter.spec";
import { IPYTHON_FIG_SPEC } from "./commands/ipython.spec";
import { AWS_VAULT_FIG_SPEC } from "./commands/aws-vault.spec";
import { CDK_FIG_SPEC } from "./commands/cdk.spec";
import { SKAFFOLD_FIG_SPEC } from "./commands/skaffold.spec";
import { TILT_FIG_SPEC } from "./commands/tilt.spec";
import { TREE_FIG_SPEC } from "./commands/tree.spec";
import { LSOF_FIG_SPEC } from "./commands/lsof.spec";
import { GREP_FIG_SPEC } from "./commands/grep.spec";
import { SED_FIG_SPEC } from "./commands/sed.spec";
import { AWK_FIG_SPEC } from "./commands/awk.spec";
import { CHMOD_FIG_SPEC } from "./commands/chmod.spec";
import { CHOWN_FIG_SPEC } from "./commands/chown.spec";
import { MKDIR_FIG_SPEC } from "./commands/mkdir.spec";
import { RMDIR_FIG_SPEC } from "./commands/rmdir.spec";
import { TOUCH_FIG_SPEC } from "./commands/touch.spec";
import { BASENAME_FIG_SPEC } from "./commands/basename.spec";
import { DIRNAME_FIG_SPEC } from "./commands/dirname.spec";
import { REALPATH_FIG_SPEC } from "./commands/realpath.spec";
import { STERN_FIG_SPEC } from "./commands/stern.spec";
import { KOPS_FIG_SPEC } from "./commands/kops.spec";
import { HELMFILE_FIG_SPEC } from "./commands/helmfile.spec";
import { KUBESEAL_FIG_SPEC } from "./commands/kubeseal.spec";
import { TRIVY_FIG_SPEC } from "./commands/trivy.spec";
import { GRYPE_FIG_SPEC } from "./commands/grype.spec";
import { HADOLINT_FIG_SPEC } from "./commands/hadolint.spec";
import { GIT_LFS_FIG_SPEC } from "./commands/git-lfs.spec";
import { LAZYGIT_FIG_SPEC } from "./commands/lazygit.spec";
import { OC_FIG_SPEC } from "./commands/oc.spec";
import { ISTIOCTL_FIG_SPEC } from "./commands/istioctl.spec";
import { LINKERD_FIG_SPEC } from "./commands/linkerd.spec";
import { CILIUM_FIG_SPEC } from "./commands/cilium.spec";
import { COSIGN_FIG_SPEC } from "./commands/cosign.spec";
import { SYFT_FIG_SPEC } from "./commands/syft.spec";
import { ORAS_FIG_SPEC } from "./commands/oras.spec";
import { CRANE_FIG_SPEC } from "./commands/crane.spec";
import { REGCTL_FIG_SPEC } from "./commands/regctl.spec";
import { TERRAFORM_DOCS_FIG_SPEC } from "./commands/terraform-docs.spec";
import { TFLINT_FIG_SPEC } from "./commands/tflint.spec";
import { TFSEC_FIG_SPEC } from "./commands/tfsec.spec";
import { CHECKOV_FIG_SPEC } from "./commands/checkov.spec";
import { INFRACOST_FIG_SPEC } from "./commands/infracost.spec";
import { YAMLLINT_FIG_SPEC } from "./commands/yamllint.spec";
import { SHELLCHECK_FIG_SPEC } from "./commands/shellcheck.spec";
import { SHFMT_FIG_SPEC } from "./commands/shfmt.spec";
import { DIRENV_FIG_SPEC } from "./commands/direnv.spec";
import { ASDF_FIG_SPEC } from "./commands/asdf.spec";
import { MISE_FIG_SPEC } from "./commands/mise.spec";
import { XH_FIG_SPEC } from "./commands/xh.spec";
import { RGA_FIG_SPEC } from "./commands/rga.spec";
import { DELTA_FIG_SPEC } from "./commands/delta.spec";
import { EZA_FIG_SPEC } from "./commands/eza.spec";
import { BTOP_FIG_SPEC } from "./commands/btop.spec";
import { HTOP_FIG_SPEC } from "./commands/htop.spec";
import { KUBIE_FIG_SPEC } from "./commands/kubie.spec";
import { KCAT_FIG_SPEC } from "./commands/kcat.spec";
import { KAFKACAT_FIG_SPEC } from "./commands/kafkacat.spec";
import { HELMWAVE_FIG_SPEC } from "./commands/helmwave.spec";
import { PROMTOOL_FIG_SPEC } from "./commands/promtool.spec";
import { GRAFANA_CLI_FIG_SPEC } from "./commands/grafana-cli.spec";
import { LOKI_FIG_SPEC } from "./commands/loki.spec";
import { TEMPO_FIG_SPEC } from "./commands/tempo.spec";
import { NERDCTL_FIG_SPEC } from "./commands/nerdctl.spec";
import { BUILDAH_FIG_SPEC } from "./commands/buildah.spec";
import { SKOPEO_FIG_SPEC } from "./commands/skopeo.spec";
import { REDIS_BENCHMARK_FIG_SPEC } from "./commands/redis-benchmark.spec";
import { MC_FIG_SPEC } from "./commands/mc.spec";
import { RCLONE_FIG_SPEC } from "./commands/rclone.spec";
import { S3CMD_FIG_SPEC } from "./commands/s3cmd.spec";
import { RABBITMQADMIN_FIG_SPEC } from "./commands/rabbitmqadmin.spec";
import { NATS_FIG_SPEC } from "./commands/nats.spec";
import { PSCALE_FIG_SPEC } from "./commands/pscale.spec";
import { SUPABASE_FIG_SPEC } from "./commands/supabase.spec";
import { DOPPLER_FIG_SPEC } from "./commands/doppler.spec";
import { SEMGREP_FIG_SPEC } from "./commands/semgrep.spec";
import { RUFF_FIG_SPEC } from "./commands/ruff.spec";
import { BIOME_FIG_SPEC } from "./commands/biome.spec";
import { GOLANGCI_LINT_FIG_SPEC } from "./commands/golangci-lint.spec";
import { KUBECONFORM_FIG_SPEC } from "./commands/kubeconform.spec";
import { KUBESCAPE_FIG_SPEC } from "./commands/kubescape.spec";
import { KUBE_SCORE_FIG_SPEC } from "./commands/kube-score.spec";
import { KUBEVAL_FIG_SPEC } from "./commands/kubeval.spec";
import { KREW_FIG_SPEC } from "./commands/krew.spec";
import { KUBECOLOR_FIG_SPEC } from "./commands/kubecolor.spec";
import { GITLEAKS_FIG_SPEC } from "./commands/gitleaks.spec";
import { TRUFFLEHOG_FIG_SPEC } from "./commands/trufflehog.spec";
import { BANDIT_FIG_SPEC } from "./commands/bandit.spec";
import { MYPY_FIG_SPEC } from "./commands/mypy.spec";
import { PIPENV_FIG_SPEC } from "./commands/pipenv.spec";
import { HATCH_FIG_SPEC } from "./commands/hatch.spec";
import { POE_FIG_SPEC } from "./commands/poe.spec";
import { SWC_FIG_SPEC } from "./commands/swc.spec";
import { ROLLUP_FIG_SPEC } from "./commands/rollup.spec";
import { PARCEL_FIG_SPEC } from "./commands/parcel.spec";
import { STORYBOOK_FIG_SPEC } from "./commands/storybook.spec";
import { COMMITLINT_FIG_SPEC } from "./commands/commitlint.spec";
import { CARGO_NEXTEST_FIG_SPEC } from "./commands/cargo-nextest.spec";
import { CARGO_DENY_FIG_SPEC } from "./commands/cargo-deny.spec";
import { CARGO_AUDIT_FIG_SPEC } from "./commands/cargo-audit.spec";
import { AIR_FIG_SPEC } from "./commands/air.spec";
import { TERRAMATE_FIG_SPEC } from "./commands/terramate.spec";
import { ATLANTIS_FIG_SPEC } from "./commands/atlantis.spec";
import { CLICKHOUSE_CLIENT_FIG_SPEC } from "./commands/clickhouse-client.spec";
import { DUCKDB_FIG_SPEC } from "./commands/duckdb.spec";
import { INFLUX_FIG_SPEC } from "./commands/influx.spec";
import { MYSQLADMIN_FIG_SPEC } from "./commands/mysqladmin.spec";
import { PGCLI_FIG_SPEC } from "./commands/pgcli.spec";
import { PRE_COMMIT_FIG_SPEC } from "./commands/pre-commit.spec";
import { ACT_FIG_SPEC } from "./commands/act.spec";
import { YAMLFMT_FIG_SPEC } from "./commands/yamlfmt.spec";
import { BUF_FIG_SPEC } from "./commands/buf.spec";
import { PROTOC_FIG_SPEC } from "./commands/protoc.spec";
import { GRPCURL_FIG_SPEC } from "./commands/grpcurl.spec";
import { HELM_DOCS_FIG_SPEC } from "./commands/helm-docs.spec";
import { TASK_FIG_SPEC } from "./commands/task.spec";
import { MAGE_FIG_SPEC } from "./commands/mage.spec";
import { GORELEASER_FIG_SPEC } from "./commands/goreleaser.spec";
import { KO_FIG_SPEC } from "./commands/ko.spec";
import { KPT_FIG_SPEC } from "./commands/kpt.spec";
import { CUE_FIG_SPEC } from "./commands/cue.spec";
import { TOFU_FIG_SPEC } from "./commands/tofu.spec";
import { AWS_SSO_UTIL_FIG_SPEC } from "./commands/aws-sso-util.spec";
import { CHAMBER_FIG_SPEC } from "./commands/chamber.spec";
import { SAML2AWS_FIG_SPEC } from "./commands/saml2aws.spec";
import { GET_CHILDITEM_FIG_SPEC } from "./commands/get-childitem.spec";
import { SET_LOCATION_FIG_SPEC } from "./commands/set-location.spec";
import { GET_CONTENT_FIG_SPEC } from "./commands/get-content.spec";
import { SELECT_STRING_FIG_SPEC } from "./commands/select-string.spec";
import { INVOKE_WEBREQUEST_FIG_SPEC } from "./commands/invoke-webrequest.spec";

// Fig subset (statically imported, generators/scripts intentionally omitted).
// Source root: https://github.com/withfig/autocomplete/tree/master/src
export const FIG_SUBSET_IMPORTED_SPECS: CommandSpec[] = [
    NPM_FIG_SPEC,
    NPX_FIG_SPEC,
    OP_FIG_SPEC,
    AGE_FIG_SPEC,
    GPG_FIG_SPEC,
    CODE_FIG_SPEC,
    CODE_INSIDERS_FIG_SPEC,
    GIT_FIG_SPEC,
    GH_FIG_SPEC,
    DOCKER_FIG_SPEC,
    DOCKER_COMPOSE_FIG_SPEC,
    PODMAN_FIG_SPEC,
    KUBECTL_FIG_SPEC,
    K3D_FIG_SPEC,
    K3S_FIG_SPEC,
    KUSTOMIZE_FIG_SPEC,
    FLUX_FIG_SPEC,
    ARGOCD_FIG_SPEC,
    HELM_FIG_SPEC,
    TERRAFORM_FIG_SPEC,
    SOPS_FIG_SPEC,
    AWS_FIG_SPEC,
    AZ_FIG_SPEC,
    GCLOUD_FIG_SPEC,
    CONSUL_FIG_SPEC,
    NOMAD_FIG_SPEC,
    VAULT_FIG_SPEC,
    BUN_FIG_SPEC,
    NODE_FIG_SPEC,
    DOTNET_FIG_SPEC,
    JAVA_FIG_SPEC,
    PYTHON_FIG_SPEC,
    PYTHON3_FIG_SPEC,
    PYTEST_FIG_SPEC,
    PG_DUMP_FIG_SPEC,
    PG_RESTORE_FIG_SPEC,
    MYSQLDUMP_FIG_SPEC,
    MONGO_FIG_SPEC,
    DENO_FIG_SPEC,
    CARGO_FIG_SPEC,
    RUSTUP_FIG_SPEC,
    GO_FIG_SPEC,
    PHP_FIG_SPEC,
    COMPOSER_FIG_SPEC,
    ARTISAN_FIG_SPEC,
    BUNDLE_FIG_SPEC,
    RAILS_FIG_SPEC,
    DBT_FIG_SPEC,
    PULUMI_FIG_SPEC,
    PACKER_FIG_SPEC,
    SAM_FIG_SPEC,
    EKSCTL_FIG_SPEC,
    SERVERLESS_FIG_SPEC,
    PIP_FIG_SPEC,
    POETRY_FIG_SPEC,
    UV_FIG_SPEC,
    NX_FIG_SPEC,
    TURBO_FIG_SPEC,
    VITE_FIG_SPEC,
    WEBPACK_FIG_SPEC,
    ESBUILD_FIG_SPEC,
    BREW_FIG_SPEC,
    DOCTL_FIG_SPEC,
    FLYCTL_FIG_SPEC,
    MAKE_FIG_SPEC,
    JUST_FIG_SPEC,
    RG_FIG_SPEC,
    FD_FIG_SPEC,
    BAT_FIG_SPEC,
    FZF_FIG_SPEC,
    JQ_FIG_SPEC,
    YQ_FIG_SPEC,
    CURL_FIG_SPEC,
    HTTP_FIG_SPEC,
    WGET_FIG_SPEC,
    NMAP_FIG_SPEC,
    OPENSSL_FIG_SPEC,
    DIG_FIG_SPEC,
    NSLOOKUP_FIG_SPEC,
    WHOIS_FIG_SPEC,
    SSH_FIG_SPEC,
    SCP_FIG_SPEC,
    SFTP_FIG_SPEC,
    SSH_KEYGEN_FIG_SPEC,
    KUBECTX_FIG_SPEC,
    KUBENS_FIG_SPEC,
    RSYNC_FIG_SPEC,
    REDIS_CLI_FIG_SPEC,
    MONGOSH_FIG_SPEC,
    TMUX_FIG_SPEC,
    K9S_FIG_SPEC,
    KIND_FIG_SPEC,
    MINIKUBE_FIG_SPEC,
    FFMPEG_FIG_SPEC,
    SQLITE3_FIG_SPEC,
    PSQL_FIG_SPEC,
    MYSQL_FIG_SPEC,
    MVN_FIG_SPEC,
    GRADLE_FIG_SPEC,
    ZOXIDE_FIG_SPEC,
    ANSIBLE_FIG_SPEC,
    ANSIBLE_PLAYBOOK_FIG_SPEC,
    ANSIBLE_GALAXY_FIG_SPEC,
    TERRAGRUNT_FIG_SPEC,
    LS_FIG_SPEC,
    CP_FIG_SPEC,
    MV_FIG_SPEC,
    RM_FIG_SPEC,
    CAT_FIG_SPEC,
    HEAD_FIG_SPEC,
    TAIL_FIG_SPEC,
    FIND_FIG_SPEC,
    XARGS_FIG_SPEC,
    CUT_FIG_SPEC,
    SORT_FIG_SPEC,
    UNIQ_FIG_SPEC,
    TR_FIG_SPEC,
    WC_FIG_SPEC,
    DU_FIG_SPEC,
    DF_FIG_SPEC,
    TAR_FIG_SPEC,
    GZIP_FIG_SPEC,
    GUNZIP_FIG_SPEC,
    XZ_FIG_SPEC,
    ZSTD_FIG_SPEC,
    ZIP_FIG_SPEC,
    UNZIP_FIG_SPEC,
    SEVEN_Z_FIG_SPEC,
    PNPM_FIG_SPEC,
    YARN_FIG_SPEC,
    TSC_FIG_SPEC,
    ESLINT_FIG_SPEC,
    PRETTIER_FIG_SPEC,
    JEST_FIG_SPEC,
    VITEST_FIG_SPEC,
    PLAYWRIGHT_FIG_SPEC,
    CYPRESS_FIG_SPEC,
    PIPX_FIG_SPEC,
    PYENV_FIG_SPEC,
    VIRTUALENV_FIG_SPEC,
    JUPYTER_FIG_SPEC,
    IPYTHON_FIG_SPEC,
    AWS_VAULT_FIG_SPEC,
    CDK_FIG_SPEC,
    SKAFFOLD_FIG_SPEC,
    TILT_FIG_SPEC,
    TREE_FIG_SPEC,
    LSOF_FIG_SPEC,
    GREP_FIG_SPEC,
    SED_FIG_SPEC,
    AWK_FIG_SPEC,
    CHMOD_FIG_SPEC,
    CHOWN_FIG_SPEC,
    MKDIR_FIG_SPEC,
    RMDIR_FIG_SPEC,
    TOUCH_FIG_SPEC,
    BASENAME_FIG_SPEC,
    DIRNAME_FIG_SPEC,
    REALPATH_FIG_SPEC,
    STERN_FIG_SPEC,
    KOPS_FIG_SPEC,
    HELMFILE_FIG_SPEC,
    KUBESEAL_FIG_SPEC,
    TRIVY_FIG_SPEC,
    GRYPE_FIG_SPEC,
    HADOLINT_FIG_SPEC,
    GIT_LFS_FIG_SPEC,
    LAZYGIT_FIG_SPEC,
    OC_FIG_SPEC,
    ISTIOCTL_FIG_SPEC,
    LINKERD_FIG_SPEC,
    CILIUM_FIG_SPEC,
    COSIGN_FIG_SPEC,
    SYFT_FIG_SPEC,
    ORAS_FIG_SPEC,
    CRANE_FIG_SPEC,
    REGCTL_FIG_SPEC,
    TERRAFORM_DOCS_FIG_SPEC,
    TFLINT_FIG_SPEC,
    TFSEC_FIG_SPEC,
    CHECKOV_FIG_SPEC,
    INFRACOST_FIG_SPEC,
    YAMLLINT_FIG_SPEC,
    SHELLCHECK_FIG_SPEC,
    SHFMT_FIG_SPEC,
    DIRENV_FIG_SPEC,
    ASDF_FIG_SPEC,
    MISE_FIG_SPEC,
    XH_FIG_SPEC,
    RGA_FIG_SPEC,
    DELTA_FIG_SPEC,
    EZA_FIG_SPEC,
    BTOP_FIG_SPEC,
    HTOP_FIG_SPEC,
    KUBIE_FIG_SPEC,
    KCAT_FIG_SPEC,
    KAFKACAT_FIG_SPEC,
    HELMWAVE_FIG_SPEC,
    PROMTOOL_FIG_SPEC,
    GRAFANA_CLI_FIG_SPEC,
    LOKI_FIG_SPEC,
    TEMPO_FIG_SPEC,
    NERDCTL_FIG_SPEC,
    BUILDAH_FIG_SPEC,
    SKOPEO_FIG_SPEC,
    REDIS_BENCHMARK_FIG_SPEC,
    MC_FIG_SPEC,
    RCLONE_FIG_SPEC,
    S3CMD_FIG_SPEC,
    RABBITMQADMIN_FIG_SPEC,
    NATS_FIG_SPEC,
    PSCALE_FIG_SPEC,
    SUPABASE_FIG_SPEC,
    DOPPLER_FIG_SPEC,
    SEMGREP_FIG_SPEC,
    RUFF_FIG_SPEC,
    BIOME_FIG_SPEC,
    GOLANGCI_LINT_FIG_SPEC,
    KUBECONFORM_FIG_SPEC,
    KUBESCAPE_FIG_SPEC,
    KUBE_SCORE_FIG_SPEC,
    KUBEVAL_FIG_SPEC,
    KREW_FIG_SPEC,
    KUBECOLOR_FIG_SPEC,
    GITLEAKS_FIG_SPEC,
    TRUFFLEHOG_FIG_SPEC,
    BANDIT_FIG_SPEC,
    MYPY_FIG_SPEC,
    PIPENV_FIG_SPEC,
    HATCH_FIG_SPEC,
    POE_FIG_SPEC,
    SWC_FIG_SPEC,
    ROLLUP_FIG_SPEC,
    PARCEL_FIG_SPEC,
    STORYBOOK_FIG_SPEC,
    COMMITLINT_FIG_SPEC,
    CARGO_NEXTEST_FIG_SPEC,
    CARGO_DENY_FIG_SPEC,
    CARGO_AUDIT_FIG_SPEC,
    AIR_FIG_SPEC,
    TERRAMATE_FIG_SPEC,
    ATLANTIS_FIG_SPEC,
    CLICKHOUSE_CLIENT_FIG_SPEC,
    DUCKDB_FIG_SPEC,
    INFLUX_FIG_SPEC,
    MYSQLADMIN_FIG_SPEC,
    PGCLI_FIG_SPEC,
    PRE_COMMIT_FIG_SPEC,
    ACT_FIG_SPEC,
    YAMLFMT_FIG_SPEC,
    BUF_FIG_SPEC,
    PROTOC_FIG_SPEC,
    GRPCURL_FIG_SPEC,
    HELM_DOCS_FIG_SPEC,
    TASK_FIG_SPEC,
    MAGE_FIG_SPEC,
    GORELEASER_FIG_SPEC,
    KO_FIG_SPEC,
    KPT_FIG_SPEC,
    CUE_FIG_SPEC,
    TOFU_FIG_SPEC,
    AWS_SSO_UTIL_FIG_SPEC,
    CHAMBER_FIG_SPEC,
    SAML2AWS_FIG_SPEC,
    GET_CHILDITEM_FIG_SPEC,
    SET_LOCATION_FIG_SPEC,
    GET_CONTENT_FIG_SPEC,
    SELECT_STRING_FIG_SPEC,
    INVOKE_WEBREQUEST_FIG_SPEC,
];
