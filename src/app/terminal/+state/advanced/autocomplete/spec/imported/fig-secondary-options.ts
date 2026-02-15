export const FIG_SECONDARY_OPTIONS: Record<string, Record<string, string[]>> = {
    git: {
        commit: ["-a", "-m", "--amend", "--no-edit", "--signoff", "--verbose"],
        push: ["-u", "--force", "--tags", "--set-upstream"],
        pull: ["--rebase", "--ff-only", "--no-rebase"],
        checkout: ["-b", "--track", "--detach"],
        switch: ["-c", "-C", "--detach"],
        rebase: ["-i", "--continue", "--abort", "--skip"],
    },
    docker: {
        run: ["-it", "--rm", "-d", "-p", "-v", "--name", "--env", "--network"],
        build: ["-t", "-f", "--build-arg", "--no-cache", "--target"],
        exec: ["-it", "--user", "--workdir", "--env"],
        logs: ["-f", "--tail", "--since", "--timestamps"],
        compose: ["up", "down", "build", "logs", "exec", "run", "pull", "push"],
    },
    "docker-compose": {
        up: ["-d", "--build", "--force-recreate", "--remove-orphans", "--wait"],
        down: ["-v", "--remove-orphans", "--rmi", "--timeout"],
        build: ["--pull", "--no-cache", "--build-arg", "--progress"],
        logs: ["-f", "--tail", "--timestamps", "--no-color"],
        exec: ["-T", "-e", "-u", "-w"],
        run: ["--rm", "-e", "-T", "-u", "-w", "--service-ports"],
    },
    kubectl: {
        get: ["-n", "-A", "-o", "--watch", "--selector"],
        describe: ["-n", "-A"],
        apply: ["-f", "-k", "--dry-run", "--server-side", "--prune", "--validate"],
        delete: ["-f", "-k", "-n", "--grace-period", "--force"],
        logs: ["-f", "-n", "--tail", "--since", "-c", "--previous", "--timestamps"],
        exec: ["-it", "-n", "-c", "--"],
        "port-forward": ["-n", "--address", "--pod-running-timeout"],
    },
    terraform: {
        init: ["-upgrade", "-reconfigure", "-backend=false"],
        plan: ["-out", "-var", "-var-file", "-target", "-destroy", "-refresh=false"],
        apply: ["-auto-approve", "-var", "-var-file", "-target", "-refresh=false"],
        destroy: ["-auto-approve", "-var", "-var-file", "-target", "-refresh=false"],
    },
    helm: {
        install: ["--namespace", "--create-namespace", "--set", "--set-string", "--values", "--version", "--wait"],
        upgrade: ["--install", "--namespace", "--set", "--set-string", "--values", "--reuse-values", "--wait"],
        uninstall: ["--namespace", "--keep-history", "--wait"],
        template: ["--namespace", "--set", "--set-string", "--values", "--include-crds"],
    },
    npm: {
        run: ["--silent", "--if-present", "--workspace", "--workspaces"],
        "run-script": ["--silent", "--if-present", "--workspace", "--workspaces"],
        install: ["--save-dev", "--save-exact", "--global", "--legacy-peer-deps"],
        test: ["--watch", "--coverage"],
    },
    pnpm: {
        run: ["--filter", "--recursive", "--parallel", "--stream"],
        install: ["--frozen-lockfile", "--prod", "--dev", "--workspace-root"],
        add: ["--save-dev", "--save-exact", "--workspace", "--filter"],
    },
    yarn: {
        run: ["--silent", "--inspect", "--top-level"],
        install: ["--immutable", "--mode", "--check-cache"],
        add: ["-D", "-E", "-T", "--peer", "--optional"],
    },
    gh: {
        pr: ["create", "list", "view", "checkout", "merge", "--repo", "--web"],
        issue: ["create", "list", "view", "close", "reopen", "--repo", "--web"],
        repo: ["clone", "create", "view", "fork", "--public", "--private", "--source"],
        workflow: ["list", "view", "run", "--repo", "--ref"],
    },
    aws: {
        s3: ["cp", "ls", "sync", "mv", "rm", "--recursive", "--exclude", "--include", "--profile", "--region"],
        ec2: ["describe-instances", "start-instances", "stop-instances", "--instance-ids", "--filters", "--profile", "--region"],
        lambda: ["invoke", "list-functions", "update-function-code", "--function-name", "--profile", "--region"],
    },
    az: {
        vm: ["list", "show", "create", "delete", "start", "stop", "--resource-group", "--name", "--image"],
        aks: ["list", "show", "get-credentials", "create", "delete", "--resource-group", "--name"],
        account: ["show", "set", "list", "--subscription"],
    },
    gcloud: {
        config: ["set", "get-value", "list", "configurations", "configurations activate"],
        compute: ["instances", "disks", "networks", "firewall-rules", "--project", "--zone", "--region"],
        run: ["deploy", "services", "revisions", "--region", "--platform", "--allow-unauthenticated", "--project"],
    },
    cargo: {
        run: ["--release", "--bin", "--example", "--features"],
        build: ["--release", "--workspace", "--target", "--features"],
        test: ["--release", "--workspace", "--package", "-- --nocapture"],
    },
    go: {
        test: ["./...", "-run", "-count", "-cover", "-v"],
        build: ["./...", "-o", "-tags", "-race"],
        run: ["./...", "-exec"],
    },
    python: {
        "-m": ["venv", "pip", "http.server", "pytest"],
    },
    python3: {
        "-m": ["venv", "pip", "http.server", "pytest"],
    },
    node: {
        "--test": ["--watch", "--test-name-pattern", "--test-only"],
        "--run": ["build", "dev", "test"],
    },
    dotnet: {
        build: ["-c", "-f", "-r", "--no-restore"],
        run: ["-c", "-f", "--project", "--no-build"],
        test: ["-c", "-f", "--filter", "--collect", "--logger"],
    },
    nx: {
        run: ["--configuration", "--skip-nx-cache", "--parallel"],
        affected: ["--target", "--base", "--head", "--parallel", "--configuration", "--projects"],
        generate: ["--project", "--dry-run", "--interactive"],
    },
    turbo: {
        run: ["--filter", "--parallel", "--concurrency", "--summarize", "--dry-run"],
        prune: ["--scope", "--docker", "--out-dir"],
        query: ["--graph", "--scope"],
    },
    vite: {
        dev: ["--host", "--port", "--open", "--strictPort"],
        build: ["--mode", "--watch", "--outDir", "--sourcemap"],
        preview: ["--host", "--port", "--open", "--strictPort"],
    },
    webpack: {
        serve: ["--open", "--hot", "--port", "--host"],
        watch: ["--mode", "--progress", "--env"],
    },
    esbuild: {
        "--bundle": ["--outfile", "--outdir", "--platform", "--target", "--minify", "--sourcemap"],
    },
    pytest: {
        "-k": ["not", "and", "or"],
        "--cov": ["--cov-report", "--cov-branch", "--cov-fail-under"],
        "--maxfail": ["1", "2", "3"],
    },
    mvn: {
        test: ["-Dtest=", "-DskipTests", "-P", "-pl", "-am"],
        clean: ["-DskipTests", "-P", "-pl", "-am"],
        package: ["-DskipTests", "-P", "-pl", "-am"],
        install: ["-DskipTests", "-P", "-pl", "-am"],
    },
    gradle: {
        test: ["--tests", "--info", "--stacktrace", "--scan", "--continue"],
        build: ["--scan", "--info", "--stacktrace", "--parallel", "--build-cache"],
        clean: ["--scan", "--info", "--stacktrace"],
    },
    tsc: {
        "--build": ["--watch", "--clean", "--verbose", "--force"],
        "--project": ["--watch", "--pretty", "--incremental"],
    },
    eslint: {
        "--fix": ["--cache", "--ext", "--config", "--max-warnings", "--format"],
        "--ext": [".js,.ts,.tsx", ".vue", ".svelte"],
    },
    prettier: {
        "--write": ["--cache", "--check", "--ignore-path", "--config", "--log-level"],
        "--check": ["--ignore-path", "--config", "--cache"],
    },
    jest: {
        "--watch": ["--coverage", "--runInBand", "--testNamePattern", "--onlyChanged"],
        "--runInBand": ["--coverage", "--detectOpenHandles", "--verbose"],
    },
    vitest: {
        run: ["--coverage", "--reporter", "--threads", "--watch=false"],
        watch: ["--coverage", "--ui", "--reporter", "--threads"],
    },
    playwright: {
        test: ["--project", "--headed", "--debug", "--grep", "--ui"],
        codegen: ["--target", "--browser", "--viewport-size", "--save-storage"],
    },
    cypress: {
        run: ["--browser", "--spec", "--headless", "--record", "--parallel"],
        open: ["--browser", "--project", "--e2e", "--component"],
    },
    pipx: {
        install: ["--python", "--include-deps", "--force", "--suffix"],
        run: ["--python", "--spec", "--pip-args"],
        inject: ["--include-apps", "--include-deps", "--force"],
    },
    pyenv: {
        install: ["-s", "-k", "-v", "--patch", "--list"],
        global: ["--unset"],
        local: ["--unset"],
    },
    jupyter: {
        notebook: ["--no-browser", "--port", "--ip", "--NotebookApp.token="],
        lab: ["--no-browser", "--port", "--ip", "--LabApp.token="],
    },
    "aws-vault": {
        exec: ["--duration", "--region", "--profile", "--debug", "--server"],
        login: ["--duration", "--region", "--stdout", "--no-session"],
        add: ["--env", "--no-session", "--prompt"],
    },
    cdk: {
        deploy: ["--all", "--require-approval", "--profile", "--context", "--hotswap"],
        diff: ["--profile", "--context", "--security-only", "--strict"],
        synth: ["--profile", "--context", "--quiet", "--validation"],
    },
    skaffold: {
        dev: ["--port-forward", "--tail", "--trigger", "--profile", "--default-repo"],
        run: ["--tail", "--profile", "--default-repo", "--cache-artifacts"],
        build: ["--profile", "--default-repo", "--cache-artifacts", "--push"],
    },
    tilt: {
        up: ["--context", "--hud", "--stream", "--watch", "--port"],
        ci: ["--timeout", "--output-snapshot-on-exit", "--file"],
    },
    kops: {
        create: ["cluster", "instancegroup", "secret", "--name", "--state", "--yes"],
        update: ["cluster", "--name", "--state", "--yes", "--admin", "--target"],
        delete: ["cluster", "--name", "--state", "--yes"],
        validate: ["cluster", "--name", "--state", "--wait"],
    },
    helmfile: {
        apply: ["-f", "-e", "-l", "--interactive", "--skip-deps", "--suppress-diff"],
        sync: ["-f", "-e", "-l", "--skip-deps", "--concurrency"],
        diff: ["-f", "-e", "-l", "--context", "--detailed-exitcode"],
        template: ["-f", "-e", "-l", "--output-dir", "--skip-deps"],
    },
    trivy: {
        image: ["--severity", "--ignore-unfixed", "--scanners", "--format", "--exit-code", "--timeout"],
        fs: ["--severity", "--ignore-unfixed", "--scanners", "--format", "--exit-code", "--timeout"],
        config: ["--severity", "--misconfig-scanners", "--format", "--exit-code"],
        kubernetes: ["--severity", "--include-namespaces", "--exclude-namespaces", "--report", "--timeout"],
    },
    grype: {
        db: ["status", "check", "list", "update", "--only-update", "--add-cpes-if-none"],
        "-o": ["table", "json", "cyclonedx", "sarif", "spdx-json"],
    },
    oc: {
        get: ["-n", "-A", "-o", "--selector", "--watch"],
        apply: ["-f", "-k", "--dry-run", "--server-side"],
        delete: ["-f", "-k", "-n", "--grace-period", "--force"],
        logs: ["-f", "-n", "--tail", "--since", "-c", "--timestamps"],
        exec: ["-it", "-n", "-c", "--"],
    },
    istioctl: {
        install: ["--set", "--revision", "--skip-confirmation", "--verify"],
        analyze: ["-A", "-n", "-k", "--use-kube", "--failure-threshold"],
        "proxy-config": ["cluster", "endpoint", "listener", "route", "secret", "bootstrap"],
    },
    linkerd: {
        install: ["--crds", "--ignore-cluster", "--identity-issuer-certificate-file", "--set"],
        check: ["--proxy", "--pre", "--wait", "--namespace"],
        inject: ["--manual", "--proxy-log-level", "--ignore-cluster", "--skip-inbound-ports"],
    },
    cilium: {
        install: ["--version", "--set", "--namespace", "--wait"],
        status: ["--wait", "--verbose", "--interactive"],
        connectivity: ["test", "--single-node", "--flow-validation", "--test", "--single-stack"],
    },
    cosign: {
        sign: ["--key", "--recursive", "--yes", "--timeout", "--upload"],
        verify: ["--key", "--certificate-identity", "--certificate-oidc-issuer", "--insecure-ignore-tlog"],
        attest: ["--key", "--predicate", "--type", "--timeout"],
    },
    syft: {
        scan: ["-o", "--scope", "--exclude", "--select-catalogers"],
        packages: ["-o", "--scope", "--exclude", "--select-catalogers"],
        convert: ["-o", "--file", "--output"],
    },
    oras: {
        push: ["--artifact-type", "--annotation", "--config", "--concurrency", "--plain-http"],
        pull: ["--output", "--include-subject", "--concurrency", "--plain-http"],
        discover: ["--artifact-type", "--distribution-spec", "--plain-http"],
    },
    crane: {
        copy: ["--platform", "--jobs", "--insecure", "--src-tls-verify", "--dest-tls-verify"],
        pull: ["--format", "--insecure", "--platform"],
        push: ["--insecure", "--platform", "--verbose"],
    },
    regctl: {
        image: ["copy", "digest", "export", "import", "inspect", "mod", "ratelimit"],
        manifest: ["get", "head", "put", "delete", "diff"],
        repo: ["ls", "set", "copy"],
    },
    checkov: {
        "-d": ["--framework", "--check", "--skip-check", "--soft-fail", "-o"],
        "-f": ["--framework", "--check", "--skip-check", "--soft-fail", "-o"],
        "--framework": ["terraform", "kubernetes", "dockerfile", "secrets", "sca_package", "github_actions"],
    },
    infracost: {
        breakdown: ["--path", "--format", "--out-file", "--show-skipped", "--terraform-plan-flags"],
        diff: ["--path", "--compare-to", "--format", "--out-file"],
        output: ["--path", "--format", "--fields", "--show-skipped"],
    },
    direnv: {
        exec: ["-s", "--", "bash", "zsh", "fish"],
        status: ["--json"],
    },
    asdf: {
        plugin: ["add", "list", "list-all", "remove", "update"],
        install: ["nodejs", "python", "golang", "java", "--verbose"],
        list: ["all", "nodejs", "python", "golang"],
    },
    mise: {
        install: ["node", "python", "go", "java", "--jobs", "--verbose"],
        use: ["-g", "-p", "--pin", "--fuzzy"],
        run: ["--raw", "--dry-run", "--continue-on-error"],
    },
    nerdctl: {
        run: ["-it", "--rm", "-d", "-p", "-v", "--name", "--env", "--network"],
        build: ["-t", "-f", "--build-arg", "--no-cache", "--target", "--progress"],
        exec: ["-it", "--user", "--workdir", "--env"],
        logs: ["-f", "--tail", "--since", "--timestamps"],
        compose: ["up", "down", "build", "logs", "exec", "run", "pull", "push"],
    },
    buildah: {
        from: ["--name", "--pull", "--platform", "--tls-verify", "--quiet"],
        run: ["--user", "--hostname", "--volume", "--workingdir", "--network"],
        commit: ["--format", "--rm", "--squash", "--timestamp", "--manifest"],
        bud: ["-f", "-t", "--build-arg", "--layers", "--no-cache", "--platform"],
    },
    skopeo: {
        copy: ["--all", "--format", "--src-creds", "--dest-creds", "--src-tls-verify", "--dest-tls-verify"],
        inspect: ["--raw", "--config", "--creds", "--tls-verify", "--retry-times"],
        sync: ["--src", "--dest", "--src-creds", "--dest-creds", "--scoped", "--all"],
    },
    helmwave: {
        build: ["--file", "--template", "--values", "--set", "--skip-deps"],
        up: ["--yes", "--build", "--diff", "--kubedog", "--wait"],
        diff: ["--detailed-exitcode", "--build", "--context"],
        destroy: ["--yes", "--wait", "--timeout"],
    },
    promtool: {
        check: ["config", "rules", "metrics", "web-config"],
        query: ["instant", "range", "--url", "--time", "--timeout"],
        test: ["rules", "--junit", "--run", "--debug"],
    },
    "grafana-cli": {
        plugins: ["ls", "list-remote", "install", "update", "remove", "upgrade-all"],
        admin: ["reset-admin-password", "data-migration", "stats"],
    },
    kcat: {
        "-C": ["-b", "-t", "-o", "-e", "-q", "-u", "-X"],
        "-P": ["-b", "-t", "-K", "-Z", "-q", "-X"],
        "-L": ["-b", "-t", "-J", "-X"],
        "-G": ["-b", "-t", "-e", "-o", "-X"],
    },
    kafkacat: {
        "-C": ["-b", "-t", "-o", "-e", "-q", "-u", "-X"],
        "-P": ["-b", "-t", "-K", "-Z", "-q", "-X"],
        "-L": ["-b", "-t", "-J", "-X"],
        "-G": ["-b", "-t", "-e", "-o", "-X"],
    },
    mc: {
        alias: ["set", "ls", "rm", "import", "export"],
        admin: ["user", "policy", "group", "info", "heal", "trace"],
        cp: ["--recursive", "--attr", "--newer-than", "--older-than", "--storage-class"],
        mirror: ["--watch", "--overwrite", "--remove", "--md5", "--exclude"],
    },
    rclone: {
        copy: ["--progress", "--checksum", "--dry-run", "--transfers", "--checkers", "--exclude"],
        sync: ["--progress", "--dry-run", "--delete-excluded", "--transfers", "--checkers", "--exclude"],
        move: ["--progress", "--dry-run", "--delete-empty-src-dirs", "--transfers"],
        mount: ["--allow-other", "--vfs-cache-mode", "--daemon", "--read-only"],
    },
    s3cmd: {
        ls: ["--recursive", "--human-readable-sizes"],
        sync: ["--delete-removed", "--exclude", "--include", "--acl-public", "--storage-class"],
        put: ["--acl-public", "--storage-class", "--server-side-encryption", "--multipart-chunk-size-mb"],
        get: ["--force", "--continue-put", "--requester-pays"],
    },
    rabbitmqadmin: {
        list: ["queues", "exchanges", "bindings", "users", "vhosts", "--vhost", "--format"],
        declare: ["queue", "exchange", "binding", "--vhost", "--durable", "--auto_delete"],
        delete: ["queue", "exchange", "binding", "--vhost", "--if-empty", "--if-unused"],
    },
    nats: {
        pub: ["--server", "--headers", "--count", "--sleep", "--user", "--password"],
        sub: ["--server", "--queue", "--raw", "--count", "--user", "--password"],
        req: ["--server", "--replies", "--timeout", "--headers", "--user", "--password"],
        stream: ["add", "ls", "info", "rm", "edit", "report"],
        consumer: ["add", "ls", "info", "next", "rm", "edit"],
    },
    pscale: {
        auth: ["login", "logout"],
        database: ["create", "list", "delete", "show"],
        branch: ["create", "list", "delete", "show", "promote"],
        "deploy-request": ["create", "list", "show", "approve", "close"],
    },
    supabase: {
        db: ["start", "stop", "reset", "dump", "push", "pull", "diff", "lint"],
        migration: ["new", "up", "down", "repair", "fetch", "list"],
        functions: ["new", "serve", "deploy", "list", "delete"],
        secrets: ["set", "list", "unset"],
    },
    doppler: {
        run: ["--", "--project", "--config", "--token", "--no-check-version"],
        secrets: ["get", "set", "download", "upload", "delete", "substitute"],
        configs: ["get", "create", "list", "tokens"],
        setup: ["--project", "--config", "--token", "--scope"],
    },
    semgrep: {
        scan: ["--config", "--exclude", "--include", "--severity", "--json", "--sarif", "--error", "--quiet"],
        ci: ["--config", "--json", "--sarif", "--error", "--suppress-errors", "--exclude"],
    },
    ruff: {
        check: ["--fix", "--unsafe-fixes", "--select", "--ignore", "--extend-select", "--line-length", "--output-format"],
        format: ["--check", "--diff", "--line-length", "--target-version", "--preview"],
    },
    biome: {
        check: ["--write", "--unsafe", "--formatter-enabled", "--linter-enabled", "--organize-imports-enabled", "--files-ignore-unknown"],
        lint: ["--write", "--unsafe", "--only", "--skip", "--diagnostic-level"],
        format: ["--write", "--indent-style", "--indent-width", "--line-width", "--quote-style"],
        ci: ["--formatter-enabled", "--linter-enabled", "--organize-imports-enabled", "--diagnostic-level"],
    },
    "golangci-lint": {
        run: ["--fix", "--out-format", "--timeout", "--config", "--enable", "--disable", "--build-tags"],
        cache: ["status", "clean"],
        linters: ["--json", "--enable-all", "--fast"],
    },
    kubeconform: {
        "-strict": ["-summary", "-output", "-ignore-missing-schemas", "-schema-location", "-kubernetes-version"],
        "-output": ["json", "junit", "pretty", "tap", "text"],
    },
    kubescape: {
        scan: ["framework", "control", "image", "--format", "--verbose", "--exclude-namespaces", "--include-namespaces"],
        submit: ["--account", "--token", "--enable-host-sensor"],
        operator: ["install", "uninstall", "status"],
    },
    pipenv: {
        install: ["--dev", "--skip-lock", "--system", "--python", "--pre", "--deploy"],
        lock: ["--clear", "--pre", "--requirements", "--dev-only"],
        run: ["python", "pytest", "ruff", "mypy"],
    },
    hatch: {
        run: ["test", "lint", "format", "--env", "--verbose"],
        env: ["create", "show", "remove", "prune", "find"],
        build: ["-t", "--hooks-only", "--clean", "--verbose"],
    },
    storybook: {
        dev: ["-p", "--host", "--ci", "--smoke-test", "--no-open"],
        build: ["--output-dir", "--docs", "--test", "--quiet"],
    },
    terramate: {
        run: ["--changed", "--tags", "--no-tags", "--parallel", "--continue-on-error"],
        generate: ["--changed", "--tags", "--parallel", "--no-generate"],
        list: ["--changed", "--tags", "--no-tags", "--why"],
    },
    atlantis: {
        server: ["--config", "--repo-config", "--repo-whitelist", "--automerge", "--port"],
    },
    influx: {
        query: ["--org", "--raw", "--file", "--host", "--token"],
        write: ["--bucket", "--org", "--precision", "--file", "--format", "--host", "--token"],
        bucket: ["create", "list", "delete", "update"],
    },
    "pre-commit": {
        run: ["--all-files", "--files", "--hook-stage", "--from-ref", "--to-ref", "--show-diff-on-failure"],
        install: ["--install-hooks", "--overwrite", "--hook-type"],
        autoupdate: ["--repo", "--freeze", "--bleeding-edge"],
    },
    buf: {
        lint: ["--path", "--config", "--error-format", "--timeout"],
        format: ["-w", "--exit-code", "--diff", "--config"],
        breaking: ["--against", "--config", "--path", "--error-format"],
        generate: ["--path", "--template", "--exclude-path", "--timeout"],
    },
    task: {
        "--list": ["--json", "--sort", "--silent"],
        "--watch": ["--interval", "--silent", "--status"],
        "--dry": ["--summary", "--verbose"],
    },
    goreleaser: {
        release: ["--clean", "--snapshot", "--skip", "--parallelism", "--timeout", "--config"],
        build: ["--snapshot", "--single-target", "--id", "--config"],
        check: ["--config", "--strict"],
    },
    tofu: {
        init: ["-upgrade", "-reconfigure", "-backend=false"],
        plan: ["-out", "-var", "-var-file", "-target", "-destroy", "-refresh=false"],
        apply: ["-auto-approve", "-var", "-var-file", "-target", "-refresh=false"],
        destroy: ["-auto-approve", "-var", "-var-file", "-target", "-refresh=false"],
    },
    chamber: {
        exec: ["--preserve-environment", "--path", "--quiet", "--", "bash", "zsh"],
        list: ["--format", "--exact-match"],
        write: ["--type", "--overwrite"],
    },
    saml2aws: {
        login: ["--profile", "--skip-prompt", "--force", "--session-duration", "--role", "--url"],
        exec: ["--profile", "--exec-profile", "--session-duration", "--", "aws", "bash"],
    },
};
